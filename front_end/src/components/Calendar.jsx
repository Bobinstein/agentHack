import { useState, useEffect } from "react";
import "./Calendar.css";

const Calendar = ({ calendarData }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("weekly"); // daily, weekly, monthly
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);

  useEffect(() => {
    if (
      calendarData &&
      calendarData.moduleData &&
      calendarData.moduleData.events
    ) {
      // Convert events object to array and parse timestamps
      const eventsArray = Object.values(calendarData.moduleData.events).map(
        (event) => ({
          ...event,
          startTime: new Date(event.startTime),
          endTime: new Date(event.endTime),
          createdAt: new Date(event.createdAt),
        })
      );
      setEvents(eventsArray);
    }
  }, [calendarData]);

  const getWeekDates = (date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDates.push(day);
    }
    return weekDates;
  };

  const getMonthDates = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - firstDay.getDay());

    const dates = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      dates.push(day);
    }
    return dates;
  };

  const getDayEvents = (date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.startTime);
      const eventEndDate = new Date(event.endTime);

      // Check if the date falls within the event's time range
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);

      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);

      const eventStart = new Date(eventDate);
      eventStart.setHours(0, 0, 0, 0);

      const eventEnd = new Date(eventEndDate);
      eventEnd.setHours(23, 59, 59, 999);

      // Event overlaps with this date if:
      // - Event starts on or before this date AND
      // - Event ends on or after this date
      return eventStart <= dateEnd && eventEnd >= dateStart;
    });
  };

  const getEventDisplayInfo = (event, date) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);

    const isFirstDay = eventStart.toDateString() === date.toDateString();
    const isLastDay = eventEnd.toDateString() === date.toDateString();

    return {
      isFirstDay,
      isLastDay,
      isMultiDay: eventStart.toDateString() !== eventEnd.toDateString(),
    };
  };

  const getTimeString = (date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const navigateDate = (direction) => {
    const newDate = new Date(currentDate);

    switch (viewMode) {
      case "daily":
        newDate.setDate(newDate.getDate() + direction);
        break;
      case "weekly":
        newDate.setDate(newDate.getDate() + direction * 7);
        break;
      case "monthly":
        newDate.setMonth(newDate.getMonth() + direction);
        break;
    }

    setCurrentDate(newDate);
  };

  const renderWeeklyView = () => {
    const weekDates = getWeekDates(currentDate);

    return (
      <div className="calendar-weekly">
        <div className="week-header">
          {weekDates.map((date, index) => (
            <div key={index} className="week-day-header">
              <div className="day-name">
                {date.toLocaleDateString([], { weekday: "short" })}
              </div>
              <div className="day-date">{date.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="week-grid">
          {weekDates.map((date, dayIndex) => (
            <div key={dayIndex} className="week-day">
              <div className="day-events">
                {getDayEvents(date).map((event, eventIndex) => {
                  const displayInfo = getEventDisplayInfo(event, date);

                  // For single-day events, only show on their start date
                  // For multi-day events, show on all relevant dates
                  if (!displayInfo.isMultiDay && !displayInfo.isFirstDay) {
                    return null;
                  }

                  return (
                    <div
                      key={eventIndex}
                      className={`calendar-event clickable ${
                        displayInfo.isMultiDay
                          ? "multi-day-event"
                          : "single-day-event"
                      }`}
                      style={{
                        backgroundColor: getEventColor(event.eventType),
                        borderColor: getEventColor(event.eventType),
                      }}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="event-time">
                        {displayInfo.isFirstDay
                          ? getTimeString(event.startTime)
                          : ""}{" "}
                        -{" "}
                        {displayInfo.isLastDay
                          ? getTimeString(event.endTime)
                          : ""}
                        {!displayInfo.isFirstDay &&
                          !displayInfo.isLastDay &&
                          "All Day"}
                      </div>
                      <div className="event-name">{event.eventName}</div>
                      {event.location && (
                        <div className="event-location">{event.location}</div>
                      )}
                      {event.description && (
                        <div className="event-description">
                          {event.description}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDailyView = () => {
    const dayEvents = getDayEvents(currentDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="calendar-daily">
        <div className="day-header">
          <h3>{formatDate(currentDate)}</h3>
        </div>
        <div className="day-timeline">
          {hours.map((hour) => {
            const hourEvents = dayEvents.filter(
              (event) => event.startTime.getHours() === hour
            );

            return (
              <div key={hour} className="hour-slot">
                <div className="hour-label">{hour}:00</div>
                <div className="hour-events">
                  {hourEvents.map((event, index) => (
                    <div
                      key={index}
                      className="calendar-event daily-event clickable"
                      style={{
                        backgroundColor: getEventColor(event.eventType),
                        borderColor: getEventColor(event.eventType),
                      }}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="event-time">
                        {getTimeString(event.startTime)} -{" "}
                        {getTimeString(event.endTime)}
                      </div>
                      <div className="event-name">{event.eventName}</div>
                      {event.location && (
                        <div className="event-location">{event.location}</div>
                      )}
                      {event.description && (
                        <div className="event-description">
                          {event.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMonthlyView = () => {
    const monthDates = getMonthDates(currentDate);
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
      <div className="calendar-monthly">
        <div className="month-header">
          {weekDays.map((day) => (
            <div key={day} className="month-day-header">
              {day}
            </div>
          ))}
        </div>
        <div className="month-grid">
          {monthDates.map((date, index) => {
            const dayEvents = getDayEvents(date);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={index}
                className={`month-day ${!isCurrentMonth ? "other-month" : ""} ${
                  isToday ? "today" : ""
                }`}
              >
                <div className="day-number">{date.getDate()}</div>
                <div className="day-events">
                  {dayEvents.slice(0, 2).map((event, eventIndex) => (
                    <div
                      key={eventIndex}
                      className="calendar-event month-event clickable"
                      style={{
                        backgroundColor: getEventColor(event.eventType),
                        borderColor: getEventColor(event.eventType),
                      }}
                      onClick={() => handleEventClick(event)}
                    >
                      <div className="event-name">{event.eventName}</div>
                      {event.location && (
                        <div className="event-location">{event.location}</div>
                      )}
                      {event.description && (
                        <div className="event-description">
                          {event.description}
                        </div>
                      )}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="more-events">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getEventColor = (eventType) => {
    const colors = {
      general: "#00ff41",
      meeting: "#00ff88",
      reminder: "#ff6b6b",
      deadline: "#ffaa00",
      default: "#00ff41",
    };
    return colors[eventType] || colors.default;
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
  };

  const renderCalendar = () => {
    switch (viewMode) {
      case "daily":
        return renderDailyView();
      case "weekly":
        return renderWeeklyView();
      case "monthly":
        return renderMonthlyView();
      default:
        return renderWeeklyView();
    }
  };

  if (!calendarData) return null;

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-navigation">
          <button className="nav-button" onClick={() => navigateDate(-1)}>
            ←
          </button>
          <button
            className="today-button"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </button>
          <button className="nav-button" onClick={() => navigateDate(1)}>
            →
          </button>
        </div>

        <div className="calendar-title">
          {viewMode === "daily" && formatDate(currentDate)}
          {viewMode === "weekly" &&
            `${formatDate(getWeekDates(currentDate)[0])} - ${formatDate(
              getWeekDates(currentDate)[6]
            )}`}
          {viewMode === "monthly" &&
            currentDate.toLocaleDateString([], {
              month: "long",
              year: "numeric",
            })}
        </div>

        <div className="calendar-view-controls">
          <button
            className={`view-button ${viewMode === "daily" ? "active" : ""}`}
            onClick={() => setViewMode("daily")}
          >
            Day
          </button>
          <button
            className={`view-button ${viewMode === "weekly" ? "active" : ""}`}
            onClick={() => setViewMode("weekly")}
          >
            Week
          </button>
          <button
            className={`view-button ${viewMode === "monthly" ? "active" : ""}`}
            onClick={() => setViewMode("monthly")}
          >
            Month
          </button>
        </div>
      </div>

      <div className="calendar-body">{renderCalendar()}</div>

      <div className="calendar-info">
        <div className="event-count">Total Events: {events.length}</div>
        <div className="timezone-info">
          Timezone: {calendarData.timezone || "Unknown"}
        </div>
      </div>

      {/* Event Detail Modal */}
      {showEventModal && selectedEvent && (
        <div className="event-modal-overlay" onClick={closeEventModal}>
          <div
            className="event-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="event-modal-header">
              <h3>{selectedEvent.eventName}</h3>
              <button className="close-button" onClick={closeEventModal}>
                ×
              </button>
            </div>

            <div className="event-modal-body">
              <div className="event-detail-row">
                <label>Time:</label>
                <span>
                  {getTimeString(selectedEvent.startTime)} -{" "}
                  {getTimeString(selectedEvent.endTime)}
                </span>
              </div>

              <div className="event-detail-row">
                <label>Date:</label>
                <span>{selectedEvent.startTime.toLocaleDateString()}</span>
              </div>

              {selectedEvent.location && (
                <div className="event-detail-row">
                  <label>Location:</label>
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {selectedEvent.description && (
                <div className="event-detail-row">
                  <label>Description:</label>
                  <span className="event-description-full">
                    {selectedEvent.description}
                  </span>
                </div>
              )}

              <div className="event-detail-row">
                <label>Type:</label>
                <span
                  className="event-type-badge"
                  style={{
                    backgroundColor: getEventColor(selectedEvent.eventType),
                  }}
                >
                  {selectedEvent.eventType}
                </span>
              </div>

              <div className="event-detail-row">
                <label>Priority:</label>
                <span
                  className={`priority-badge priority-${selectedEvent.priority}`}
                >
                  {selectedEvent.priority}
                </span>
              </div>

              <div className="event-detail-row">
                <label>Created:</label>
                <span>{selectedEvent.createdAt.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
