import { useState, useEffect } from "react";
import "./Weather.css";

const Weather = ({ weatherData }) => {
  const [currentWeather, setCurrentWeather] = useState(null);
  const [dailyForecast, setDailyForecast] = useState(null);
  const [defaultLocation, setDefaultLocation] = useState("Little France, NY");

  useEffect(() => {
    if (weatherData) {
      // Get the default location from module data
      if (weatherData.moduleData && weatherData.moduleData.defaultLocation) {
        setDefaultLocation(weatherData.moduleData.defaultLocation);
      }

      // Get current weather from the hourly cache (hourly is our "current" weather)
      if (weatherData.completeCache && weatherData.completeCache.hourly) {
        const hourlyKey = defaultLocation + "_hourly";
        const hourlyData = weatherData.completeCache.hourly[hourlyKey];
        if (hourlyData) {
          setCurrentWeather(hourlyData);
        }
      }

      // Get daily forecast from the daily cache
      if (weatherData.completeCache && weatherData.completeCache.daily) {
        const dailyKey = defaultLocation + "_daily";
        const dailyData = weatherData.completeCache.daily[dailyKey];
        if (dailyData) {
          setDailyForecast(dailyData);
        }
      }
    }
  }, [weatherData, defaultLocation]);

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

  const parseCurrentWeather = (description) => {
    if (!description) return null;

    // Extract current weather data from the description (same parsing logic as emails.lua)
    const tempMatch = description.match(
      /temperature is approximately ([\d.]+) K/
    );
    const humidityMatch = description.match(/humidity is at ([\d]+)%/);
    const windMatch = description.match(/wind speed of ([\d.]+) m\/s/);
    const directionMatch = description.match(/coming from the (\w+)/);
    const conditionsMatch = description.match(/conditions showing ([^.]+)/);

    if (tempMatch) {
      return {
        temperature: parseFloat(tempMatch[1]),
        humidity: humidityMatch ? humidityMatch[1] : null,
        windSpeed: windMatch ? windMatch[1] : null,
        windDirection: directionMatch ? directionMatch[1] : null,
        conditions: conditionsMatch ? conditionsMatch[1].trim() : null,
      };
    }

    return null;
  };

  const parseDailyForecast = (description) => {
    if (!description) return [];

    // Extract forecast data from the AI description (same as before)
    const lines = description.split("\n");
    const forecasts = [];

    lines.forEach((line) => {
      if (
        line.includes("**") &&
        line.includes("High:") &&
        line.includes("Low:")
      ) {
        const dateMatch = line.match(/\*\*(.*?)\*\*/);
        const highMatch = line.match(/High:\s*([\d.]+)\s*K/);
        const lowMatch = line.match(/Low:\s*([\d.]+)\s*K/);
        const conditionsMatch = line.match(/Conditions:\s*(.*?)(?=\n|$)/);

        if (dateMatch && highMatch && lowMatch) {
          forecasts.push({
            date: dateMatch[1].trim(),
            high: parseFloat(highMatch[1]),
            low: parseFloat(lowMatch[1]),
            conditions: conditionsMatch ? conditionsMatch[1].trim() : "Unknown",
          });
        }
      }
    });

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
      {currentData && (
        <div className="weather-section current-weather">
          <div className="weather-section-header">
            <h4>Current Weather - {defaultLocation}</h4>
          </div>
          <div className="current-weather-content">
            <div className="weather-main">
              <div className="weather-icon">🌤️</div>
              <div className="weather-details">
                <div className="temperature">{currentData.temperature} K</div>
                <div className="conditions">
                  {currentData.conditions || "Unknown conditions"}
                </div>
                <div className="location">{defaultLocation}</div>
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
          </div>
        </div>
      )}

      {/* Daily Forecast Section */}
      {forecasts.length > 0 && (
        <div className="weather-section daily-forecast">
          <h4>7-Day Forecast - {defaultLocation}</h4>
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
                <div className="forecast-conditions">{forecast.conditions}</div>
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
        </div>
      )}
    </div>
  );
};

export default Weather;
