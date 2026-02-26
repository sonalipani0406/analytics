#!/bin/bash
# Extreme Test Suite Curls

curl -X GET 'http://localhost:5000/api/analytics?period=day'
curl -X GET 'http://localhost:5000/api/analytics?period=day&visitor_type_filter=unique'
curl -X GET 'http://localhost:5000/api/analytics?period=day&visitor_type_filter=repeated'
curl -X GET 'http://localhost:5000/api/analytics?period=day&device_filter=Desktop'
curl -X GET 'http://localhost:5000/api/analytics?period=day&device_filter=Desktop&visitor_type_filter=unique'
curl -X GET 'http://localhost:5000/api/analytics?period=day&device_filter=Desktop&visitor_type_filter=repeated'
curl -X GET 'http://localhost:5000/api/analytics?period=day&browser_filter=Chrome'
curl -X GET 'http://localhost:5000/api/analytics?period=day&browser_filter=Chrome&visitor_type_filter=unique'
curl -X GET 'http://localhost:5000/api/analytics?period=day&browser_filter=Chrome&visitor_type_filter=repeated'
