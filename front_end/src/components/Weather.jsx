import { useState, useEffect } from "react";
import "./Weather.css";

const Weather = ({ weatherData }) => {
  const [currentWeather, setCurrentWeather] = useState(null);
  const [dailyForecast, setDailyForecast] = useState(null);

  useEffect(() => {
    if (weatherData) {
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
        setCurrentWeather(null);
        setDailyForecast(null);
        return;
      }

      // Get current weather from the hourly cache (hourly is our "current" weather)
      if (weatherData.completeCache && weatherData.completeCache.hourly) {
        const hourlyKey = location + "_hourly";
        const hourlyData = weatherData.completeCache.hourly[hourlyKey];
        if (hourlyData) {
          console.log("Found hourly data for key:", hourlyKey);
          setCurrentWeather(hourlyData);
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
        if (dailyData) {
          console.log("Found daily data for key:", dailyKey);
          setDailyForecast(dailyData);
        } else {
          console.log("No daily data found for key:", dailyKey);
          setDailyForecast({
            error: `No daily weather data available for ${location}`,
          });
        }
      } else {
        setDailyForecast({ error: "No daily weather cache available" });
      }
    }
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
      const hourMatch = line.match(
        /- \*\*(\d{2}:\d{2})\*\* - Temperature: ([\d.]+) K, Condition: ([^,\n]+)/
      );

      if (hourMatch) {
        console.log("Found hourly weather data:", hourMatch);
        const conditions = hourMatch[3].trim();
        console.log("Extracted conditions:", conditions);
        return {
          temperature: parseFloat(hourMatch[2]),
          conditions: conditions,
          time: hourMatch[1],
          humidity: null, // Not available in hourly format
          windSpeed: null, // Not available in hourly format
          windDirection: null, // Not available in hourly format
        };
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
    return null;
  };

  const parseDailyForecast = (description) => {
    if (!description) return [];

    console.log("Parsing daily forecast description:", description);

    // Extract forecast data from the AI description
    const lines = description.split("\n");
    const forecasts = [];
    let currentForecast = null;

    lines.forEach((line, index) => {
      // Look for date lines like "**September 2, 2025**"
      const dateMatch = line.match(/\*\*(.*?)\*\*/);
      if (dateMatch) {
        // If we have a previous forecast, save it
        if (currentForecast) {
          forecasts.push(currentForecast);
        }
        // Start a new forecast
        currentForecast = {
          date: dateMatch[1].trim(),
          high: null,
          low: null,
          conditions: "Unknown",
        };
        console.log("Found date:", dateMatch[1].trim());
      }

      // Look for high temperature lines like "- High: 296.52 K"
      const highMatch = line.match(/- High:\s*([\d.]+)\s*K/);
      if (highMatch && currentForecast) {
        currentForecast.high = parseFloat(highMatch[1]);
        console.log("Found high temp:", highMatch[1]);
      }

      // Look for low temperature lines like "- Low: 288.63 K"
      const lowMatch = line.match(/- Low:\s*([\d.]+)\s*K/);
      if (lowMatch && currentForecast) {
        currentForecast.low = parseFloat(lowMatch[1]);
        console.log("Found low temp:", lowMatch[1]);
      }

      // Look for conditions lines like "- Conditions: Partly cloudy with clear spells"
      const conditionsMatch = line.match(/- Conditions:\s*(.*?)(?=\n|$)/);
      if (conditionsMatch && currentForecast) {
        currentForecast.conditions = conditionsMatch[1].trim();
        console.log("Found conditions:", conditionsMatch[1].trim());
      }
    });

    // Don't forget the last forecast
    if (currentForecast && currentForecast.high && currentForecast.low) {
      forecasts.push(currentForecast);
    }

    console.log("Parsed forecasts:", forecasts);
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

  return (
    <div className="weather-container">
      {/* Current Weather Section */}
      <div className="weather-section current-weather">
        <div className="weather-section-header">
          <h4>Current Weather - {getCurrentLocation()}</h4>
        </div>
        <div className="current-weather-content">
          {currentWeather?.error ? (
            <div className="weather-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{currentWeather.error}</div>
            </div>
          ) : currentData ? (
            <>
              <div className="weather-main">
                <div className="weather-icon">🌤️</div>
                <div className="weather-details">
                  <div className="temperature">{currentData.temperature} K</div>
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
              </div>
            </>
          ) : (
            <div className="weather-loading">Loading current weather...</div>
          )}
        </div>
      </div>

      {/* Daily Forecast Section */}
      <div className="weather-section daily-forecast">
        <h4>7-Day Forecast - {getCurrentLocation()}</h4>
        <div className="forecast-content">
          {dailyForecast?.error ? (
            <div className="weather-error">
              <div className="error-icon">⚠️</div>
              <div className="error-message">{dailyForecast.error}</div>
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
                      <div className="temp-high">High: {forecast.high} K</div>
                      <div className="temp-low">Low: {forecast.low} K</div>
                    </div>
                    <div className="forecast-conditions">
                      {forecast.conditions}
                    </div>
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
              </div>
            </>
          ) : (
            <div className="weather-loading">Loading daily forecast...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Weather;
