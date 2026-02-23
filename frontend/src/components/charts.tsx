
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from "chart.js";
import { useTheme } from "next-themes";
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Globe, Smartphone, Building, FileText } from "lucide-react";
import { Map, MapControls, MapPopup, useMap } from "@/components/ui/map";
import am5geodata_worldLow from "@amcharts/amcharts5-geodata/worldLow";
import MapLibreGL from "maplibre-gl";

ChartJS.register(
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  ChartDataLabels
);

const countryCodeMapping: { [key: string]: string } = {
  'AD': 'Andorra', 'AE': 'United Arab Emirates', 'AF': 'Afghanistan', 'AG': 'Antigua and Barbuda',
  'AI': 'Anguilla', 'AL': 'Albania', 'AM': 'Armenia', 'AO': 'Angola', 'AQ': 'Antarctica',
  'AR': 'Argentina', 'AS': 'American Samoa', 'AT': 'Austria', 'AU': 'Australia',
  'AW': 'Aruba', 'AX': 'Åland Islands', 'AZ': 'Azerbaijan', 'BA': 'Bosnia and Herzegovina',
  'BB': 'Barbados', 'BD': 'Bangladesh', 'BE': 'Belgium', 'BF': 'Burkina Faso',
  'BG': 'Bulgaria', 'BH': 'Bahrain', 'BI': 'Burundi', 'BJ': 'Benin', 'BL': 'Saint Barthélemy',
  'BM': 'Bermuda', 'BN': 'Brunei', 'BO': 'Bolivia', 'BQ': 'Caribbean Netherlands',
  'BR': 'Brazil', 'BS': 'Bahamas', 'BT': 'Bhutan', 'BV': 'Bouvet Island',
  'BW': 'Botswana', 'BY': 'Belarus', 'BZ': 'Belize', 'CA': 'Canada',
  'CC': 'Cocos Islands', 'CD': 'Democratic Republic of the Congo', 'CF': 'Central African Republic',
  'CG': 'Congo', 'CH': 'Switzerland', 'CI': 'Ivory Coast', 'CK': 'Cook Islands',
  'CL': 'Chile', 'CM': 'Cameroon', 'CN': 'China', 'CO': 'Colombia', 'CR': 'Costa Rica',
  'CU': 'Cuba', 'CV': 'Cape Verde', 'CW': 'Curaçao', 'CX': 'Christmas Island',
  'CY': 'Cyprus', 'CZ': 'Czech Republic', 'DE': 'Germany', 'DJ': 'Djibouti',
  'DK': 'Denmark', 'DM': 'Dominica', 'DO': 'Dominican Republic', 'DZ': 'Algeria',
  'EC': 'Ecuador', 'EE': 'Estonia', 'EG': 'Egypt', 'EH': 'Western Sahara',
  'ER': 'Eritrea', 'ES': 'Spain', 'ET': 'Ethiopia', 'FI': 'Finland', 'FJ': 'Fiji',
  'FK': 'Falkland Islands', 'FM': 'Micronesia', 'FO': 'Faroe Islands', 'FR': 'France',
  'GA': 'Gabon', 'GB': 'United Kingdom', 'GD': 'Grenada', 'GE': 'Georgia',
  'GF': 'French Guiana', 'GG': 'Guernsey', 'GH': 'Ghana', 'GI': 'Gibraltar',
  'GL': 'Greenland', 'GM': 'Gambia', 'GN': 'Guinea', 'GP': 'Guadeloupe',
  'GQ': 'Equatorial Guinea', 'GR': 'Greece', 'GS': 'South Georgia', 'GT': 'Guatemala',
  'GU': 'Guam', 'GW': 'Guinea-Bissau', 'GY': 'Guyana', 'HK': 'Hong Kong',
  'HM': 'Heard Island', 'HN': 'Honduras', 'HR': 'Croatia', 'HT': 'Haiti',
  'HU': 'Hungary', 'ID': 'Indonesia', 'IE': 'Ireland', 'IL': 'Israel',
  'IM': 'Isle of Man', 'IN': 'India', 'IO': 'British Indian Ocean Territory', 'IQ': 'Iraq',
  'IR': 'Iran', 'IS': 'Iceland', 'IT': 'Italy', 'JE': 'Jersey', 'JM': 'Jamaica',
  'JO': 'Jordan', 'JP': 'Japan', 'KE': 'Kenya', 'KG': 'Kyrgyzstan', 'KH': 'Cambodia',
  'KI': 'Kiribati', 'KM': 'Comoros', 'KN': 'Saint Kitts and Nevis', 'KP': 'North Korea',
  'KR': 'South Korea', 'KW': 'Kuwait', 'KY': 'Cayman Islands', 'KZ': 'Kazakhstan',
  'LA': 'Laos', 'LB': 'Lebanon', 'LC': 'Saint Lucia', 'LI': 'Liechtenstein',
  'LK': 'Sri Lanka', 'LR': 'Liberia', 'LS': 'Lesotho', 'LT': 'Lithuania',
  'LU': 'Luxembourg', 'LV': 'Latvia', 'LY': 'Libya', 'MA': 'Morocco',
  'MC': 'Monaco', 'MD': 'Moldova', 'ME': 'Montenegro', 'MF': 'Saint Martin',
  'MG': 'Madagascar', 'MH': 'Marshall Islands', 'MK': 'Macedonia', 'ML': 'Mali',
  'MM': 'Myanmar', 'MN': 'Mongolia', 'MO': 'Macao', 'MP': 'Northern Mariana Islands',
  'MQ': 'Martinique', 'MR': 'Mauritania', 'MS': 'Montserrat', 'MT': 'Malta',
  'MU': 'Mauritius', 'MV': 'Maldives', 'MW': 'Malawi', 'MX': 'Mexico',
  'MY': 'Malaysia', 'MZ': 'Mozambique', 'NA': 'Namibia', 'NC': 'New Caledonia',
  'NE': 'Niger', 'NF': 'Norfolk Island', 'NG': 'Nigeria', 'NI': 'Nicaragua',
  'NL': 'Netherlands', 'NO': 'Norway', 'NP': 'Nepal', 'NR': 'Nauru',
  'NU': 'Niue', 'NZ': 'New Zealand', 'OM': 'Oman', 'PA': 'Panama',
  'PE': 'Peru', 'PF': 'French Polynesia', 'PG': 'Papua New Guinea', 'PH': 'Philippines',
  'PK': 'Pakistan', 'PL': 'Poland', 'PM': 'Saint Pierre and Miquelon', 'PN': 'Pitcairn',
  'PR': 'Puerto Rico', 'PS': 'Palestine', 'PT': 'Portugal', 'PW': 'Palau',
  'PY': 'Paraguay', 'QA': 'Qatar', 'RE': 'Reunion', 'RO': 'Romania',
  'RS': 'Serbia', 'RU': 'Russia', 'RW': 'Rwanda', 'SA': 'Saudi Arabia',
  'SB': 'Solomon Islands', 'SC': 'Seychelles', 'SD': 'Sudan', 'SE': 'Sweden',
  'SG': 'Singapore', 'SH': 'Saint Helena', 'SI': 'Slovenia', 'SJ': 'Svalbard and Jan Mayen',
  'SK': 'Slovakia', 'SL': 'Sierra Leone', 'SM': 'San Marino', 'SN': 'Senegal',
  'SO': 'Somalia', 'SR': 'Suriname', 'SS': 'South Sudan', 'ST': 'São Tomé and Príncipe',
  'SV': 'El Salvador', 'SX': 'Sint Maarten', 'SY': 'Syria', 'SZ': 'Swaziland',
  'TC': 'Turks and Caicos Islands', 'TD': 'Chad', 'TF': 'French Southern Territories',
  'TG': 'Togo', 'TH': 'Thailand', 'TJ': 'Tajikistan', 'TK': 'Tokau',
  'TL': 'East Timor', 'TM': 'Turkmenistan', 'TN': 'Tunisia', 'TO': 'Tonga',
  'TR': 'Turkey', 'TT': 'Trinidad and Tobago', 'TV': 'Tuvalu', 'TW': 'Taiwan',
  'TZ': 'Tanzania', 'UA': 'Ukraine', 'UG': 'Uganda', 'UM': 'United States Minor Outlying Islands',
  'US': 'United States', 'UY': 'Uruguay', 'UZ': 'Uzbekistan', 'VA': 'Vatican',
  'VC': 'Saint Vincent and the Grenadines', 'VE': 'Venezuela', 'VG': 'British Virgin Islands',
  'VI': 'U.S. Virgin Islands', 'VN': 'Vietnam', 'VU': 'Vanuatu', 'WF': 'Wallis and Futuna',
  'WS': 'Samoa', 'YE': 'Yemen', 'YT': 'Mayotte', 'ZA': 'South Africa',
  'ZM': 'Zambia', 'ZW': 'Zimbabwe'
};

export interface GlobalVisitorData {
  id: string;
  value: number;
  unique_visitors: number;
  returning_visitors: number;
}

export interface DeviceAnalyticsData {
  device_type: string;
  count: number;
}

export interface BrowserDistributionData {
  browser: string;
  count: number;
}

export interface AnalyticsChartsGridProps {
  chartsData: {
    by_device: DeviceAnalyticsData[];
    by_browser: BrowserDistributionData[];
  };
}

function WorldChoroplethLayer({ data }: { data: GlobalVisitorData[] }) {
  const { map, isLoaded } = useMap();
  const { theme } = useTheme();
  const [hoverInfo, setHoverInfo] = useState<{
    longitude: number;
    latitude: number;
    feature: any;
  } | null>(null);

  const geoData = useMemo(() => {
    const baseData = am5geodata_worldLow as any; // Using existing amcharts geodata as source
    if (!baseData || !baseData.features) return null;

    // Clone to avoid mutating original
    const features = baseData.features.map((feature: any) => {
      const countryData = data?.find(d => d.id === feature.id);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          value: countryData?.value || 0,
          unique_visitors: countryData?.unique_visitors || 0,
          returning_visitors: countryData?.returning_visitors || 0,
          name: countryCodeMapping[feature.id] || feature.properties.name || feature.id
        }
      };
    });

    return {
      type: "FeatureCollection" as const,
      features
    };
  }, [data]);

  useEffect(() => {
    if (!isLoaded || !map || !geoData) return;

    const sourceId = "world-source";
    const fillLayerId = "world-fill";
    const lineLayerId = "world-line";

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: "geojson",
        data: geoData
      });

      // Find max value for color scaling
      const maxValue = Math.max(...(data?.map(d => d.value) || [0]), 100);

      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            theme === 'dark' ? "#60a5fa" : "#3b82f6", // Brighter blue on hover
            [
              "interpolate",
              ["linear"],
              ["get", "value"],
              0, theme === 'dark' ? "#1f2937" : "#e5e7eb", // Gray for 0
              1, theme === 'dark' ? "#312e81" : "#dbeafe", // Deep Indigo/Light Blue for low
              maxValue, theme === 'dark' ? "#4f46e5" : "#2563eb" // Indigo/Blue for high
            ]
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            1.0,
            0.9
          ]
        }
      });

      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": theme === 'dark' ? "#374151" : "#ffffff",
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            1.5,
            0.5
          ]
        }
      });

      // Interactions
      map.on("mousemove", fillLayerId, (e: any) => {
        if (e.features.length > 0) {
          map.getCanvas().style.cursor = "pointer";
          const feature = e.features[0];
          setHoverInfo({
            longitude: e.lngLat.lng,
            latitude: e.lngLat.lat,
            feature: feature
          });
          // Highlight effect
          map.setFeatureState(
            { source: sourceId, id: feature.id },
            { hover: true }
          );
        }
      });

      map.on("mouseleave", fillLayerId, () => {
        map.getCanvas().style.cursor = "";
        setHoverInfo(null);
      });
    } else {
      // Update data if it changes
      const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource;
      source.setData(geoData);
    }

    return () => {
      // Cleanup if needed, though map handles cleanup on unmount usually
      // We can rely on Map component cleanup
    };
  }, [isLoaded, map, geoData, theme, data]);

  return (
    <>
      {hoverInfo && (
        <MapPopup
          longitude={hoverInfo.longitude}
          latitude={hoverInfo.latitude}
          closeButton={false}
          className="p-2 min-w-[200px]"
        >
          <div className="flex flex-col gap-1">
            <h4 className="font-bold text-sm">{hoverInfo.feature.properties.name}</h4>
            <div className="text-xs text-muted-foreground">
              <div>Total Visitors: <span className="text-foreground font-medium">{hoverInfo.feature.properties.value}</span></div>
              <div>Unique: <span className="text-foreground font-medium">{hoverInfo.feature.properties.unique_visitors}</span></div>
              <div>Returning: <span className="text-foreground font-medium">{hoverInfo.feature.properties.returning_visitors}</span></div>
            </div>
          </div>
        </MapPopup>
      )}
    </>
  );
}

export function GlobalVisitorChart({ data }: { data: GlobalVisitorData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Global Visitor Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] w-full rounded-lg overflow-hidden border border-border">
          <Map>
            <WorldChoroplethLayer data={data} />
            <MapControls position="bottom-right" />
          </Map>
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceAnalyticsChart({ data }: { data: any }) {
  const chartData = {
    labels: data?.map((d: any) => d.device_type) || [],
    datasets: [
      {
        data: data?.map((d: any) => d.count) || [],
        backgroundColor: ['rgba(59, 130, 246, 0.5)', 'rgba(16, 185, 129, 0.5)', 'rgba(245, 158, 11, 0.5)', 'rgba(239, 68, 68, 0.5)', 'rgba(139, 92, 246, 0.5)', 'rgba(236, 72, 153, 0.5)'],
        borderColor: '#1a1f2e',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#e6e8eb', padding: 20, usePointStyle: true },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> Device Analytics</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] w-full">
        <Doughnut data={chartData} options={options} />
      </CardContent>
    </Card>
  );
}

function BrowserDistributionChart({ data }: { data: any }) {
  const chartData = {
    labels: data?.map((d: any) => d.browser) || [],
    datasets: [
      {
        data: data?.map((d: any) => d.count) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { display: false } },
      x: { ticks: { color: '#9ca3af' }, grid: { display: false } },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Browser Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] w-full">
        <Bar data={chartData} options={options} />
      </CardContent>
    </Card>
  );
}


export function AnalyticsChartsGrid({ chartsData }: { chartsData: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
      <DeviceAnalyticsChart data={chartsData?.by_device} />
      <BrowserDistributionChart data={chartsData?.by_browser} />
    </div>
  );
}

export function CityDistributionChart({ data }: { data: any }) {
  const chartData = {
    labels: data?.map((d: any) => d.city) || [],
    datasets: [
      {
        data: data?.map((d: any) => d.count) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { display: false } },
      x: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { display: false } },
    },
    barPercentage: 0.6,
    categoryPercentage: 0.8,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> City Distribution</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] w-full">
        <Bar data={chartData} options={options} />
      </CardContent>
    </Card>
  );
}

export function TopPagesChart({ data }: { data: any }) {
  const chartData = {
    labels: data?.map((d: any) => d.page_visited) || [],
    datasets: [
      {
        data: data?.map((d: any) => d.count) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        anchor: 'end' as const,
        align: 'end' as const,
        formatter: (value: any) => {
          return value;
        },
        color: '#e6e8eb',
      },
    },
    scales: {
      y: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { display: false } },
      x: { beginAtZero: true, ticks: { color: '#9ca3af' }, grid: { display: false } },
    },
    barPercentage: 0.6,
    categoryPercentage: 0.8,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Top Pages</CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] w-full">
        <Bar data={chartData} options={options} />
      </CardContent>
    </Card>
  );
}
