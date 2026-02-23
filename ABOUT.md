This project is a sophisticated, full-stack **web analytics dashboard** engineered to deliver real-time, detailed insights into website visitor traffic. It is built upon a robust and modern architecture, featuring a **Python Flask backend**, a powerful **Supabase (PostgreSQL) database**, and a highly interactive and responsive frontend crafted with **HTML, JavaScript, and Tailwind CSS**. The application is meticulously configured for streamlined, serverless deployment on the **Vercel platform**.

### **Backend Architecture (Flask)**

The core of the application is the **Flask server (`app.py`)**, which acts as the intermediary between the frontend dashboard and the Supabase database. It exposes a set of well-defined API endpoints to handle data collection, retrieval, and rendering.

* **Data Ingestion (`/track` endpoint):** This POST endpoint is the primary entry point for visitor data. When a user visits a tracked website, an embedded JavaScript snippet sends a JSON payload here. The backend then performs several crucial processing steps:
    * **User Agent Parsing:** It uses the `user-agents` library to parse the raw user agent string, extracting detailed information like browser family, operating system, and whether the device is a mobile, tablet, or desktop.
    * **Data Normalization:** It cleans the incoming data, for instance, by converting "unknown" values to `None` and using the `pycountry` library to find the correct two-letter country code from a full country name.
    * **Database Upsert:** The processed data is then "upserted" into the `visitors` table in Supabase. The `upsert` operation, based on the unique `session_id`, efficiently creates a new record or updates an existing one, preventing duplicate entries for the same session.

* **Session Duration Logging (`/log/time` endpoint):** To track user engagement, this endpoint receives updates on the time a visitor has spent on a page. It updates the `time_spent_seconds` field for a given `session_id` in the database.

* **Data Retrieval (`/api/analytics` endpoint):** This is the powerhouse for the frontend. It receives filter parameters from the dashboard (e.g., date range, country). These parameters are then passed to a Remote Procedure Call (RPC) in Supabase named `get_filtered_analytics_visual`. This design is highly efficient as it offloads the complex data filtering and aggregation logic to the database itself. The Flask endpoint simply facilitates the request and returns the resulting JSON data to the client.

* **Dashboard Rendering (`/dashboard` endpoint):** This simple route serves the main `dashboard.html` file, which contains all the frontend logic.

### **Database Logic (Supabase/PostgreSQL)**

The project's data layer is expertly designed to handle analytics workloads efficiently.

* **`visitors` Table:** This table is the single source of truth, with a schema designed to capture a rich set of analytics data points, including `public_ip`, `country`, `page_visited`, `device_type`, `browser`, `operating_system`, `session_id`, and `time_spent_seconds`.

* **`get_filtered_analytics_visual` Function:** This PostgreSQL function is the secret sauce of the application's performance. Instead of pulling raw data and processing it in Python, this function performs all the heavy lifting directly within the database. It accepts various filter parameters and uses Common Table Expressions (CTEs) to progressively filter the `visitors` table. Finally, it uses PostgreSQL's powerful JSON functions (`json_build_object`, `json_agg`) to construct a nested JSON object that contains all the data the frontend needs:
    * **`stats`**: Aggregated metrics like total visitors, unique visitors, and average time on page.
    * **`visitor_list`**: A list of the 100 most recent visitors.
    * **`charts`**: Aggregated data pre-formatted for each chart (by country, date, device, and browser).
    * **`meta`**: Lists of distinct values for populating the filter dropdowns (e.g., all unique countries, devices).
   

### **Frontend Design and Interactivity (`dashboard.html`)**

The frontend is a single-page application that provides a rich, data-driven user experience.

* **Styling and Layout:** **Tailwind CSS** is used for a utility-first styling approach, enabling a clean, modern, and highly responsive design. The UI is built with a dark theme, using CSS variables for easy customization of colors and styles.

* **Data Visualization:** The dashboard employs two key charting libraries:
    * **amCharts:** Used to render the interactive world map, providing a visually compelling representation of the geographic distribution of visitors.
    * **Chart.js:** Powers the other visualizations, including the traffic timeline (line chart), device analytics (doughnut chart), and browser distribution (bar chart).

* **Dynamic Data Loading:** The core logic resides in a JavaScript block within the HTML file. On page load, and every 30 seconds thereafter, the `loadData` function is called. This function:
    1.  Gathers the current values from all the filter inputs.
    2.  Constructs a query string and makes an asynchronous `fetch` request to the `/api/analytics` endpoint.
    3.  Upon receiving the JSON response, it calls a series of `update` functions (`updateStats`, `updateCharts`, `updateVisitorsTable`, etc.) to dynamically refresh every component on the page with the new data.

### **Deployment and Configuration**

The project is designed for ease of deployment using **Vercel**.

* **`vercel.json`:** This configuration file instructs Vercel on how to build and serve the project. It specifies that `app.py` should be deployed as a Python serverless function and includes a rewrite rule so that all incoming requests are routed to the Flask application.
* **`requirements.txt`:** This file lists all the necessary Python dependencies, allowing for a reproducible build environment. The project is licensed under the permissive **MIT License**, encouraging wide adoption and modification.
