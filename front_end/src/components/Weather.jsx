import { useState, useEffect, useRef } from "react";
import "./Weather.css";

const Weather = ({ weatherData }) => {
  const [currentWeather, setCurrentWeather] = useState(null);
  const [dailyForecast, setDailyForecast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const intervalRef = useRef(null);

  // Process weather data when it changes
  useEffect(() => {
    const processWeatherData = () => {
      if (!weatherData) {
        setIsLoading(false);
        return;
      }

      console.log("Weather component - Processing weather data:", weatherData);

      // Use the exact location from the response
      const location = weatherData.location;

      console.log("Weather component - Using location:", location);
      console.log(
        "Weather component - Available hourly keys:",
        weatherData.completeCache?.hourly
          ? Object.keys(weatherData.completeCache.hourly)
          : "No hourly cache"
      );
      console.log(
        "Weather component - Available daily keys:",
        weatherData.completeCache?.daily
          ? Object.keys(weatherData.completeCache.daily)
          : "No daily cache"
      );

      if (!location) {
        console.log("No location specified in weather data");
        setCurrentWeather({ error: "No location specified" });
        setDailyForecast({ error: "No location specified" });
        setIsLoading(false);
        return;
      }

      let hasData = false;

      // Get current weather from the hourly cache (hourly is our "current" weather)
      if (weatherData.completeCache && weatherData.completeCache.hourly) {
        const hourlyKey = location + "_hourly";
        const hourlyData = weatherData.completeCache.hourly[hourlyKey];
        if (hourlyData && hourlyData.description) {
          console.log("Found hourly data for key:", hourlyKey);
          setCurrentWeather(hourlyData);
          hasData = true;
        } else {
          console.log("No hourly data found for key:", hourlyKey);
          setCurrentWeather({
            error: `No hourly weather data available for ${location}`,
          });
        }
      } else {
        setCurrentWeather({ error: "No hourly weather cache available" });
      }

      // Get daily forecast from the daily cache
      if (weatherData.completeCache && weatherData.completeCache.daily) {
        const dailyKey = location + "_daily";
        const dailyData = weatherData.completeCache.daily[dailyKey];
        if (dailyData && dailyData.description) {
          console.log("Found daily data for key:", dailyKey);
          setDailyForecast(dailyData);
          hasData = true;
        } else {
          console.log("No daily data found for key:", dailyKey);
          setDailyForecast({
            error: `No daily weather data available for ${location}`,
          });
        }
      } else {
        setDailyForecast({ error: "No daily weather cache available" });
      }

      setIsLoading(false);
      setLastRefresh(new Date());
    };

    processWeatherData();
  }, [weatherData]);

  // Auto-refresh mechanism
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up auto-refresh every 2 minutes if we have weather data
    if (weatherData && weatherData.location) {
      intervalRef.current = setInterval(() => {
        console.log("Auto-refreshing weather data...");
        setLastRefresh(new Date());
        // The parent component should handle the actual data refresh
        // This just updates our local refresh timestamp
      }, 2 * 60 * 1000); // 2 minutes
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [weatherData]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown";

    // Handle both microsecond and millisecond timestamps
    let date;
    if (timestamp > 1000000000000000) {
      // Microsecond timestamp
      date = new Date(timestamp / 1000);
    } else {
      // Millisecond timestamp
      date = new Date(timestamp);
    }

    return date.toLocaleString();
  };

  // Get the current location for display
  const getCurrentLocation = () => {
    if (!weatherData) return "No location";
    return weatherData.location || "No location";
  };

  const parseCurrentWeather = (description) => {
    if (!description) return null;

    console.log("Parsing current weather description:", description);

    // Try to extract the first hourly entry as "current" weather
    // Look for pattern like "- **03:00** - Temperature: 293.19 K, Condition: Scattered clouds"
    const lines = description.split("\n");
    console.log("All lines in description:", lines);

    for (const line of lines) {
      // Try multiple patterns to match different AI response formats
      const patterns = [
        // Pattern 1: "**6:00 AM**: 288.46 K, Clear sky" (ACTUAL FORMAT FROM CONSOLE)
        /\*\*(\d{1,2}:\d{2} (?:AM|PM))\*\*: ([\d.]+) K, ([^,\n]+)/,
        // Pattern 2: "**6 AM**: 288.46 K, Clear sky" (without minutes)
        /\*\*(\d{1,2} (?:AM|PM))\*\*: ([\d.]+) K, ([^,\n]+)/,
        // Pattern 3: "**4 PM**: 296.82 K - Few clouds" (with dash)
        /\*\*(\d{1,2} (?:AM|PM))\*\*: ([\d.]+) K - ([^,\n]+)/,
        // Pattern 4: "**12 PM**: 293.98 K - Few clouds" (with minutes and dash)
        /\*\*(\d{1,2}:\d{2} (?:AM|PM))\*\*: ([\d.]+) K - ([^,\n]+)/,
        // Pattern 5: "- **03:00** - Temperature: 293.19 K, Condition: Scattered clouds"
        /- \*\*(\d{2}:\d{2})\*\* - Temperature: ([\d.]+) K, Condition: ([^,\n]+)/,
        // Pattern 6: More flexible time format
        /\*\*([^*]+)\*\*: ([\d.]+) K, ([^,\n]+)/,
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          console.log(
            "Found hourly weather data with pattern:",
            pattern,
            match
          );
          const conditions = match[3].trim();
          console.log("Extracted conditions:", conditions);
          return {
            temperature: parseFloat(match[2]),
            conditions: conditions,
            time: match[1],
            humidity: null, // Not available in hourly format
            windSpeed: null, // Not available in hourly format
            windDirection: null, // Not available in hourly format
          };
        }
      }
    }

    // Fallback: try the old format for backward compatibility
    const tempMatch = description.match(
      /temperature is approximately ([\d.]+) K/
    );
    const humidityMatch = description.match(/humidity is at ([\d]+)%/);
    const windMatch = description.match(/wind speed of ([\d.]+) m\/s/);
    const directionMatch = description.match(/coming from the (\w+)/);
    const conditionsMatch = description.match(/conditions showing ([^.]+)/);

    if (tempMatch) {
      console.log("Found old format weather data:", tempMatch);
      return {
        temperature: parseFloat(tempMatch[1]),
        humidity: humidityMatch ? humidityMatch[1] : null,
        windSpeed: windMatch ? windMatch[1] : null,
        windDirection: directionMatch ? directionMatch[1] : null,
        conditions: conditionsMatch ? conditionsMatch[1].trim() : null,
      };
    }

    console.log("No weather data could be parsed from description");

    // Fallback: return a basic structure with the raw description
    // This ensures something is always displayed when data exists
    return {
      temperature: null,
      conditions: "Raw data available below",
      time: null,
      humidity: null,
      windSpeed: null,
      windDirection: null,
      rawDescription: description, // Include the raw description for display
      isFallback: true, // Flag to indicate this is fallback data
    };
  };

  const parseDailyForecast = (description) => {
    if (!description) return [];

    console.log("Parsing daily forecast description:", description);

    // Extract forecast data from the AI description
    const lines = description.split("\n");
    const forecasts = [];
    let currentForecast = null;

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();

      // Skip empty lines
      if (!trimmedLine) return;

      // Look for various date patterns:
      // 1. "**September 2, 2025**" - specific month/day/year format
      // 2. "**Day 1:**" or "**Day 2:**"
      // 3. "**Monday, September 2**"
      // 4. "**September 2**"
      const datePatterns = [
        /\*\*(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\*\*/i, // Month Day, Year
        /\*\*Day\s+\d+:\*\*/i, // "Day 1:", "Day 2:", etc.
        /\*\*[A-Za-z]+day,?\s+[A-Za-z]+\s+\d+\*\*/i, // "Monday, September 2"
        /\*\*[A-Za-z]+\s+\d+\*\*/i, // "September 2"
      ];

      let dateMatch = null;
      for (const pattern of datePatterns) {
        dateMatch = trimmedLine.match(pattern);
        if (dateMatch) break;
      }

      if (dateMatch) {
        // If we have a previous forecast, save it
        if (currentForecast) {
          forecasts.push(currentForecast);
        }
        // Start a new forecast
        // Extract the date text from the match
        let dateText = "";
        if (dateMatch[1]) {
          // For patterns with capture groups (like month names)
          dateText = dateMatch[1].trim();
        } else {
          // For patterns without capture groups, extract from the full match
          dateText = dateMatch[0].replace(/\*\*/g, "").trim();
        }

        currentForecast = {
          date: dateText,
          high: null,
          low: null,
          conditions: "Unknown",
        };
        console.log("Found date:", currentForecast.date);
      }

      // Look for temperature patterns:
      // 1. "- High: 296.52 K"
      // 2. "High: 296.52 K"
      // 3. "High: 296.52°K"
      // 4. "High temperature: 296.52 K"
      // 5. "- **High/Low:** 299.4 K / 292.12 K" (AI format)
      const highLowPattern =
        /-?\s*\*\*High\/Low:\*\*\s*([\d.]+)\s*K\s*\/\s*([\d.]+)\s*K/i;
      const highLowMatch = trimmedLine.match(highLowPattern);

      if (highLowMatch && currentForecast) {
        currentForecast.high = parseFloat(highLowMatch[1]);
        currentForecast.low = parseFloat(highLowMatch[2]);
        console.log(
          "Found high/low temps:",
          highLowMatch[1],
          "/",
          highLowMatch[2]
        );
      } else {
        // Fallback to individual patterns
        const highPatterns = [
          /-?\s*High:?\s*([\d.]+)\s*[°]?K/i,
          /-?\s*High\s+temperature:?\s*([\d.]+)\s*[°]?K/i,
          /-?\s*Maximum:?\s*([\d.]+)\s*[°]?K/i,
        ];

        const lowPatterns = [
          /-?\s*Low:?\s*([\d.]+)\s*[°]?K/i,
          /-?\s*Low\s+temperature:?\s*([\d.]+)\s*[°]?K/i,
          /-?\s*Minimum:?\s*([\d.]+)\s*[°]?K/i,
        ];

        // Check for high temperature
        for (const pattern of highPatterns) {
          const highMatch = trimmedLine.match(pattern);
          if (highMatch && currentForecast) {
            currentForecast.high = parseFloat(highMatch[1]);
            console.log("Found high temp:", highMatch[1]);
            break;
          }
        }

        // Check for low temperature
        for (const pattern of lowPatterns) {
          const lowMatch = trimmedLine.match(pattern);
          if (lowMatch && currentForecast) {
            currentForecast.low = parseFloat(lowMatch[1]);
            console.log("Found low temp:", lowMatch[1]);
            break;
          }
        }
      }

      // Look for conditions patterns:
      // 1. "- Conditions: Partly cloudy with clear spells"
      // 2. "Conditions: Partly cloudy"
      // 3. "Weather: Partly cloudy"
      // 4. "Partly cloudy" (standalone)
      // 5. "- **Conditions:** Partly cloudy with rain." (AI format)
      const conditionsPatterns = [
        /-?\s*\*\*Conditions:\*\*\s*(.+)/i, // AI format: **Conditions:** text
        /-?\s*Conditions?:?\s*(.+)/i,
        /-?\s*Weather:?\s*(.+)/i,
        /-?\s*Forecast:?\s*(.+)/i,
      ];

      // Check for conditions
      for (const pattern of conditionsPatterns) {
        const conditionsMatch = trimmedLine.match(pattern);
        if (conditionsMatch && currentForecast) {
          currentForecast.conditions = conditionsMatch[1].trim();
          console.log("Found conditions:", conditionsMatch[1].trim());
          break;
        }
      }

      // If no specific pattern matches but we have a current forecast and this line contains weather-related words
      if (
        currentForecast &&
        !dateMatch &&
        !trimmedLine.match(/High|Low|Conditions|Weather|Forecast/i)
      ) {
        // Check if this might be a standalone conditions line
        const weatherWords = [
          "cloudy",
          "clear",
          "sunny",
          "rainy",
          "snow",
          "fog",
          "wind",
          "storm",
          "partly",
          "mostly",
          "overcast",
        ];
        const hasWeatherWords = weatherWords.some((word) =>
          trimmedLine.toLowerCase().includes(word)
        );

        if (hasWeatherWords && currentForecast.conditions === "Unknown") {
          currentForecast.conditions = trimmedLine;
          console.log("Found standalone conditions:", trimmedLine);
        }
      }
    });

    // Don't forget the last forecast
    if (currentForecast) {
      forecasts.push(currentForecast);
    }

    console.log("Parsed forecasts:", forecasts);

    // If no forecasts were parsed, return a fallback with the raw description
    if (forecasts.length === 0) {
      console.log("No daily forecasts could be parsed, returning fallback");
      return [
        {
          date: "Current",
          high: null,
          low: null,
          conditions: "Raw data available below",
          rawDescription: description,
          isFallback: true,
        },
      ];
    }

    return forecasts;
  };

  const getWeatherIcon = (conditions) => {
    if (!conditions) return "🌤️";

    const lowerConditions = conditions.toLowerCase();

    if (lowerConditions.includes("rain")) return "🌧️";
    if (lowerConditions.includes("cloud")) return "☁️";
    if (lowerConditions.includes("clear")) return "☀️";
    if (lowerConditions.includes("snow")) return "❄️";
    if (lowerConditions.includes("storm")) return "⛈️";
    if (lowerConditions.includes("fog")) return "🌫️";

    return "🌤️";
  };

  if (!weatherData) return null;

  const currentData = parseCurrentWeather(currentWeather?.description);
  const forecasts = parseDailyForecast(dailyForecast?.description);

  // Debug logging
  console.log("Weather render - currentData:", currentData);
  console.log("Weather render - currentWeather:", currentWeather);
  console.log("Weather render - forecasts:", forecasts);

  return (
    <div className="weather-container">
      {/* Current Weather Section */}
      <div className="weather-section current-weather">
        <div className="weather-section-header">
          <h4>Current Weather - {getCurrentLocation()}</h4>
        </div>
        <div className="current-weather-content">
          {isLoading ? (
            <div className="weather-loading">
              <div className="loading-spinner">⏳</div>
              <div className="loading-text">Loading current weather...</div>
            </div>
          ) : currentWeather?.error ? (
            <div className="weather-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{currentWeather.error}</div>
              {lastRefresh && (
                <div className="refresh-info">
                  Last checked: {lastRefresh.toLocaleTimeString()}
                </div>
              )}
            </div>
          ) : currentData ? (
            <>
              <div className="current-weather-main-content">
                <div className="weather-main">
                  <div className="weather-icon">🌤️</div>
                  <div className="weather-details">
                    {currentData.temperature ? (
                      <div className="temperature">
                        {currentData.temperature} K
                      </div>
                    ) : (
                      <div className="temperature">-- K</div>
                    )}
                    <div className="conditions">
                      {currentData.conditions || "Unknown conditions"}
                    </div>
                    {currentData.time && (
                      <div className="weather-time">{currentData.time}</div>
                    )}
                    <div className="location">{getCurrentLocation()}</div>
                  </div>
                </div>
                <div className="weather-metrics">
                  {currentData.humidity && (
                    <div className="metric">
                      <label>Humidity:</label>
                      <span>{currentData.humidity}%</span>
                    </div>
                  )}
                  {currentData.windSpeed && (
                    <div className="metric">
                      <label>Wind:</label>
                      <span>{currentData.windSpeed} m/s</span>
                    </div>
                  )}
                  {currentData.windDirection && (
                    <div className="metric">
                      <label>Direction:</label>
                      <span>{currentData.windDirection}</span>
                    </div>
                  )}
                  <div className="metric">
                    <label>Last Updated:</label>
                    <span>{formatTimestamp(currentWeather?.timestamp)}</span>
                  </div>
                  {lastRefresh && (
                    <div className="metric">
                      <label>UI Refreshed:</label>
                      <span>{lastRefresh.toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Show raw description when parsing fails or when explicitly requested */}
              {currentData.rawDescription && (
                <div className="raw-weather-description">
                  <h5>Raw Weather Data:</h5>
                  <div className="description-text">
                    {currentData.rawDescription}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="weather-loading">
              <div className="loading-spinner">⏳</div>
              <div className="loading-text">Waiting for weather data...</div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Forecast Section */}
      <div className="weather-section daily-forecast">
        <h4>7-Day Forecast - {getCurrentLocation()}</h4>
        <div className="forecast-content">
          {isLoading ? (
            <div className="weather-loading">
              <div className="loading-spinner">⏳</div>
              <div className="loading-text">Loading daily forecast...</div>
            </div>
          ) : dailyForecast?.error ? (
            <div className="weather-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{dailyForecast.error}</div>
              {lastRefresh && (
                <div className="refresh-info">
                  Last checked: {lastRefresh.toLocaleTimeString()}
                </div>
              )}
            </div>
          ) : forecasts.length > 0 ? (
            <>
              <div className="forecast-grid">
                {forecasts.map((forecast, index) => (
                  <div key={index} className="forecast-day">
                    <div className="forecast-header">
                      <div className="forecast-date">{forecast.date}</div>
                      <div className="forecast-icon">
                        {getWeatherIcon(forecast.conditions)}
                      </div>
                    </div>
                    <div className="forecast-temps">
                      {forecast.high ? (
                        <div className="temp-high">High: {forecast.high} K</div>
                      ) : (
                        <div className="temp-high">High: -- K</div>
                      )}
                      {forecast.low ? (
                        <div className="temp-low">Low: {forecast.low} K</div>
                      ) : (
                        <div className="temp-low">Low: -- K</div>
                      )}
                    </div>
                    <div className="forecast-conditions">
                      {forecast.conditions}
                    </div>
                    {/* Show raw description for this forecast if parsing failed */}
                    {forecast.rawDescription && (
                      <div className="forecast-raw-description">
                        <details>
                          <summary>Raw Data</summary>
                          <div className="description-text">
                            {forecast.rawDescription}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="forecast-info">
                <div className="forecast-timestamp">
                  <label>Forecast Updated:</label>
                  <span>{formatTimestamp(dailyForecast?.timestamp)}</span>
                </div>
                <div className="forecast-source">
                  <label>Source:</label>
                  <span>{dailyForecast?.source || "AI Assistant"}</span>
                </div>
                {lastRefresh && (
                  <div className="forecast-refresh">
                    <label>UI Refreshed:</label>
                    <span>{lastRefresh.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="weather-loading">
              <div className="loading-spinner">⏳</div>
              <div className="loading-text">Waiting for forecast data...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Weather;
