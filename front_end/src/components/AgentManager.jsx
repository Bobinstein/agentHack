import { useState, useEffect } from "react";
import "./AgentManager.css";
import Calendar from "./Calendar";
import Weather from "./Weather";
import { message, createDataItemSigner } from "@permaweb/aoconnect";

const AgentManager = ({ walletAddress, envVars, onShowEnvConfig }) => {
  const [agentData, setAgentData] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAddToken, setShowAddToken] = useState(false);
  const [newTokenId, setNewTokenId] = useState("");
  const [addingToken, setAddingToken] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [newLocation, setNewLocation] = useState("");
  const [settingLocation, setSettingLocation] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [originalNote, setOriginalNote] = useState("");
  const [updatingNote, setUpdatingNote] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    eventName: "",
    startTime: "",
    endTime: "",
    isAllDay: false,
    description: "",
    eventType: "general",
    location: "",
    priority: "medium",
  });
  const [addingEvent, setAddingEvent] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);

  // Update parsedData when agentData changes
  useEffect(() => {
    if (agentData) {
      const parsed = parseAgentData(agentData);
      setParsedData(parsed);
    } else {
      setParsedData(null);
    }
  }, [agentData]);

  // Auto-refresh mechanism
  useEffect(() => {
    // Clear any existing interval
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }

    // Set up auto-refresh every 3 minutes if we have data
    if (parsedData && parsedData.weather) {
      const interval = setInterval(() => {
        console.log("Auto-refreshing agent data...");
        getAgentData();
      }, 3 * 60 * 1000); // 3 minutes

      setAutoRefreshInterval(interval);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [parsedData]);

  const handleAddToken = async () => {
    if (!newTokenId.trim() || !envVars.AGENT_PROCESS_ID) return;

    setAddingToken(true);
    setError(null);

    try {
      // Create data item signer using window.arweaveWallet
      const signer = createDataItemSigner(window.arweaveWallet);

      // Send message to add token to portfolio
      const txId = await message({
        process: envVars.AGENT_PROCESS_ID,
        tags: [
          { name: "Action", value: "Add-Token-To-Portfolio" },
          { name: "TokenId", value: newTokenId.trim() },
        ],
        signer: signer,
        data: "Add Token to Portfolio",
      });

      console.log("Token added successfully:", txId);

      // Close modal and reset form
      setShowAddToken(false);
      setNewTokenId("");

      // Refresh agent data to show the new token
      await getAgentData();
    } catch (err) {
      console.error("Failed to add token:", err);
      setError("Failed to add token: " + (err.message || "Unknown error"));
    } finally {
      setAddingToken(false);
    }
  };

  const handleSetLocation = async () => {
    if (!newLocation.trim() || !envVars.AGENT_PROCESS_ID) return;

    setSettingLocation(true);
    setError(null);

    try {
      // Create data item signer using window.arweaveWallet
      const signer = createDataItemSigner(window.arweaveWallet);

      // Send message to set weather location
      const txId = await message({
        process: envVars.AGENT_PROCESS_ID,
        tags: [
          { name: "Action", value: "set-weather-location" },
          { name: "Location", value: newLocation.trim() },
        ],
        signer: signer,
        data: "Set Weather Location",
      });

      console.log("Location set successfully:", txId);

      // Close modal and reset form
      setShowLocationModal(false);
      setNewLocation("");

      // Refresh agent data to show the new location
      await getAgentData();
    } catch (err) {
      console.error("Failed to set location:", err);
      setError("Failed to set location: " + (err.message || "Unknown error"));
    } finally {
      setSettingLocation(false);
    }
  };

  const handleUpdateNote = async () => {
    if (!noteContent.trim() || !envVars.AGENT_PROCESS_ID) return;

    setUpdatingNote(true);
    setError(null);

    try {
      // Create data item signer using window.arweaveWallet
      const signer = createDataItemSigner(window.arweaveWallet);

      // Send message to update the note
      const txId = await message({
        process: envVars.AGENT_PROCESS_ID,
        tags: [{ name: "Action", value: "Set-note" }],
        signer: signer,
        data: noteContent.trim(),
      });

      console.log("Note updated successfully:", txId);

      // Update local state
      setOriginalNote(noteContent.trim());
      setEditingNote(false);

      // Refresh agent data to show the updated note
      await getAgentData();
    } catch (err) {
      console.error("Failed to update note:", err);
      setError("Failed to update note: " + (err.message || "Unknown error"));
    } finally {
      setUpdatingNote(false);
    }
  };

  const handleAddEvent = async () => {
    if (
      !newEvent.eventName.trim() ||
      !newEvent.startTime ||
      !envVars.AGENT_PROCESS_ID
    )
      return;

    setAddingEvent(true);
    setError(null);

    try {
      // Create data item signer using window.arweaveWallet
      const signer = createDataItemSigner(window.arweaveWallet);

      // Convert dates to milliseconds if they're not already
      const startTime =
        typeof newEvent.startTime === "string"
          ? new Date(newEvent.startTime).getTime()
          : newEvent.startTime;
      const endTime = newEvent.endTime
        ? typeof newEvent.endTime === "string"
          ? new Date(newEvent.endTime).getTime()
          : newEvent.endTime
        : startTime;

      // Send message to add calendar event
      const txId = await message({
        process: envVars.AGENT_PROCESS_ID,
        tags: [
          { name: "Action", value: "add-event" },
          { name: "Event-Name", value: newEvent.eventName.trim() },
          { name: "Start-Time", value: startTime.toString() },
          { name: "End-Time", value: endTime.toString() },
          { name: "Is-All-Day", value: newEvent.isAllDay.toString() },
          { name: "Description", value: newEvent.description.trim() },
          { name: "Event-Type", value: newEvent.eventType },
          { name: "Location", value: newEvent.location.trim() },
          { name: "Priority", value: newEvent.priority },
        ],
        signer: signer,
        data: "Add Calendar Event",
      });

      console.log("Event added successfully:", txId);

      // Close modal and reset form
      setShowAddEvent(false);
      setNewEvent({
        eventName: "",
        startTime: "",
        endTime: "",
        isAllDay: false,
        description: "",
        eventType: "general",
        location: "",
        priority: "medium",
      });

      // Refresh agent data to show the new event
      await getAgentData();
    } catch (err) {
      console.error("Failed to add event:", err);
      setError("Failed to add event: " + (err.message || "Unknown error"));
    } finally {
      setAddingEvent(false);
    }
  };

  const checkEnvironmentVariables = () => {
    const missingVars = Object.entries(envVars).filter(
      ([key, value]) => !value
    );
    return missingVars.length === 0;
  };

  const getAgentData = async () => {
    if (!checkEnvironmentVariables()) {
      setError("Process IDs not configured. Please configure them first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Import @permaweb/aoconnect dynamically to avoid SSR issues
      const { dryrun } = await import("@permaweb/aoconnect");

      const result = await dryrun({
        process: envVars.AGENT_PROCESS_ID,
        tags: [{ name: "Action", value: "get-daily-summary" }],
        data: "Get Complete Data Dump",
      });

      console.log("GUS agent dryrun result:", result);

      // Parse the result - this will depend on your agent's response format
      setAgentData(result);
      setLastUpdated(new Date().toLocaleString());
    } catch (err) {
      console.error("Error getting GUS agent data:", err);
      setError(err.message || "Failed to get GUS agent data");
    } finally {
      setLoading(false);
    }
  };

  const parseAgentData = (data) => {
    try {
      if (data.Messages && data.Messages[0] && data.Messages[0].Data) {
        const parsed = JSON.parse(data.Messages[0].Data);

        // Initialize note content for editing
        if (parsed.note && !originalNote) {
          setNoteContent(parsed.note);
          setOriginalNote(parsed.note);
        }

        return parsed;
      }
      return null;
    } catch (err) {
      console.error("Failed to parse agent data:", err);
      return null;
    }
  };

  const renderDataSection = (title, data, isObject = false) => {
    if (!data) return null;

    if (isObject && typeof data === "object") {
      return (
        <div className="data-section">
          <h4>{title}</h4>
          <div className="data-content">
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        </div>
      );
    }

    return (
      <div className="data-section">
        <h4>{title}</h4>
        <div className="data-value">{String(data)}</div>
      </div>
    );
  };

  const renderAgentData = () => {
    if (!agentData || !parsedData) return null;

    return (
      <div className="agent-data">
        {/* Date Header */}
        {lastUpdated && (
          <div className="date-header">
            <h2>{new Date(lastUpdated).toLocaleDateString()}</h2>
          </div>
        )}

        {/* Portfolio Section */}
        {parsedData.portfolio && (
          <div className="data-section portfolio-section">
            <div className="section-header">
              <h4>Portfolio</h4>
              <button
                className="add-token-button"
                onClick={() => setShowAddToken(true)}
              >
                + Add Token
              </button>
            </div>

            {/* Add Token Modal - positioned within portfolio section */}
            {showAddToken && (
              <div className="add-token-overlay">
                <div className="overlay-content">
                  <h5>Add Token to Portfolio</h5>
                  <div className="input-group">
                    <label htmlFor="tokenId">Token ID:</label>
                    <input
                      id="tokenId"
                      type="text"
                      value={newTokenId}
                      onChange={(e) => setNewTokenId(e.target.value)}
                      placeholder="Enter token ID (e.g., 4hXj_E-5fAKmo4E8KjgQvuDJKAFk9P2grhycVmISDLs)"
                      disabled={addingToken}
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      className="cancel-button"
                      onClick={() => {
                        setShowAddToken(false);
                        setNewTokenId("");
                      }}
                      disabled={addingToken}
                    >
                      Cancel
                    </button>
                    <button
                      className="add-button"
                      onClick={handleAddToken}
                      disabled={!newTokenId.trim() || addingToken}
                    >
                      {addingToken ? "Adding..." : "Add Token"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="portfolio-summary">
              <div className="summary-item">
                <label>Total Items:</label>
                <span>{parsedData.portfolio.itemCount || 0}</span>
              </div>
              <div className="summary-item">
                <label>Total Value:</label>
                <span>
                  $
                  {parsedData.portfolio.totalValue
                    ? parseFloat(parsedData.portfolio.totalValue).toFixed(2)
                    : "0.00"}
                </span>
              </div>
            </div>

            {/* Token Balances */}
            {parsedData.portfolio.balances && (
              <div className="balances-section">
                <h5>Token Balances</h5>
                <div className="balances-grid">
                  {Object.entries(parsedData.portfolio.balances).map(
                    ([ticker, data]) => (
                      <div key={ticker} className="balance-item">
                        <div className="token-header">
                          <h6>{ticker}</h6>
                        </div>
                        <div className="balance-details">
                          <div className="detail-row">
                            <label>Balance:</label>
                            <span className="balance">
                              {data.parsed
                                ? parseFloat(data.parsed).toFixed(6)
                                : "0.000000"}
                            </span>
                          </div>
                          {data.usdValue && (
                            <div className="detail-row">
                              <label>USD Value:</label>
                              <span className="usd-value">
                                ${parseFloat(data.usdValue).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Token Prices Section */}
        {parsedData.tokenPrices && (
          <div className="data-section token-prices-section">
            <h4>Token Prices</h4>
            <div className="token-prices-grid">
              {Object.entries(parsedData.tokenPrices).map(([ticker, data]) => (
                <div key={ticker} className="token-price-item">
                  <div className="token-header">
                    <h6>{ticker}</h6>
                  </div>
                  <div className="price-details">
                    <div className="detail-row">
                      <label>Price:</label>
                      <span className="price">
                        ${parseFloat(data.price).toFixed(6)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <label>Source:</label>
                      <span className="source">{data.source}</span>
                    </div>
                    <div className="detail-row">
                      <label>Last Updated:</label>
                      <span className="last-updated">
                        {new Date(parseInt(data.lastUpdated)).toLocaleString()}
                      </span>
                    </div>
                    <div className="detail-row">
                      <label>DEX:</label>
                      <span className="dex">{data.DEX}</span>
                    </div>
                    <div className="detail-row">
                      <label>Execution Time:</label>
                      <span className="execution-time">
                        {data.executionTime}ms
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weather Section */}
        {parsedData.weather && (
          <div className="data-section weather-section">
            <div className="section-header">
              <h4>Weather</h4>
              <button
                className="set-location-button"
                onClick={() => setShowLocationModal(true)}
              >
                Set Location
              </button>
            </div>

            {/* Set Location Modal */}
            {showLocationModal && (
              <div className="set-location-overlay">
                <div className="overlay-content">
                  <h5>Set Weather Location</h5>
                  <div className="input-group">
                    <label htmlFor="location">Location:</label>
                    <input
                      id="location"
                      type="text"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="Enter city, state (e.g., New York City, NY)"
                      disabled={settingLocation}
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      className="cancel-button"
                      onClick={() => {
                        setShowLocationModal(false);
                        setNewLocation("");
                      }}
                      disabled={settingLocation}
                    >
                      Cancel
                    </button>
                    <button
                      className="set-button"
                      onClick={handleSetLocation}
                      disabled={!newLocation.trim() || settingLocation}
                    >
                      {settingLocation ? "Setting..." : "Set Location"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <Weather weatherData={parsedData.weather} />
          </div>
        )}

        {/* Calendar Section */}
        {parsedData.calendar && (
          <div className="data-section calendar-section">
            <div className="section-header">
              <h4>Calendar</h4>
              <button
                className="add-event-button"
                onClick={() => setShowAddEvent(true)}
              >
                + Add Event
              </button>
            </div>

            {/* Add Event Modal */}
            {showAddEvent && (
              <div className="add-event-overlay">
                <div className="overlay-content">
                  <h5>Add Calendar Event</h5>

                  <div className="input-group">
                    <label htmlFor="eventName">Event Name *:</label>
                    <input
                      id="eventName"
                      type="text"
                      value={newEvent.eventName}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, eventName: e.target.value })
                      }
                      placeholder="Enter event name"
                      disabled={addingEvent}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="startTime">Start Time *:</label>
                    <input
                      id="startTime"
                      type="datetime-local"
                      value={newEvent.startTime}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, startTime: e.target.value })
                      }
                      disabled={addingEvent}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="endTime">End Time:</label>
                    <input
                      id="endTime"
                      type="datetime-local"
                      value={newEvent.endTime}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, endTime: e.target.value })
                      }
                      disabled={addingEvent}
                    />
                  </div>

                  <div className="input-group checkbox-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={newEvent.isAllDay}
                        onChange={(e) =>
                          setNewEvent({
                            ...newEvent,
                            isAllDay: e.target.checked,
                          })
                        }
                        disabled={addingEvent}
                      />
                      All Day Event
                    </label>
                  </div>

                  <div className="input-group">
                    <label htmlFor="description">Description:</label>
                    <textarea
                      id="description"
                      value={newEvent.description}
                      onChange={(e) =>
                        setNewEvent({
                          ...newEvent,
                          description: e.target.value,
                        })
                      }
                      placeholder="Enter event description"
                      rows={3}
                      disabled={addingEvent}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="eventType">Event Type:</label>
                    <select
                      id="eventType"
                      value={newEvent.eventType}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, eventType: e.target.value })
                      }
                      disabled={addingEvent}
                    >
                      <option value="general">General</option>
                      <option value="meeting">Meeting</option>
                      <option value="appointment">Appointment</option>
                      <option value="reminder">Reminder</option>
                      <option value="deadline">Deadline</option>
                    </select>
                  </div>

                  <div className="input-group">
                    <label htmlFor="location">Location:</label>
                    <input
                      id="location"
                      type="text"
                      value={newEvent.location}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, location: e.target.value })
                      }
                      placeholder="Enter event location"
                      disabled={addingEvent}
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="priority">Priority:</label>
                    <select
                      id="priority"
                      value={newEvent.priority}
                      onChange={(e) =>
                        setNewEvent({ ...newEvent, priority: e.target.value })
                      }
                      disabled={addingEvent}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div className="modal-actions">
                    <button
                      className="cancel-button"
                      onClick={() => {
                        setShowAddEvent(false);
                        setNewEvent({
                          eventName: "",
                          startTime: "",
                          endTime: "",
                          isAllDay: false,
                          description: "",
                          eventType: "general",
                          location: "",
                          priority: "medium",
                        });
                      }}
                      disabled={addingEvent}
                    >
                      Cancel
                    </button>
                    <button
                      className="add-button"
                      onClick={handleAddEvent}
                      disabled={
                        !newEvent.eventName.trim() ||
                        !newEvent.startTime ||
                        addingEvent
                      }
                    >
                      {addingEvent ? "Adding..." : "Add Event"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <Calendar calendarData={parsedData.calendar} />
          </div>
        )}

        {/* Distributions Section */}
        {parsedData.distributions && (
          <div className="data-section distributions-section">
            <h4>Distributions</h4>
            <div className="distributions-grid">
              {Object.entries(parsedData.distributions).map(([token, data]) => (
                <div key={token} className="distribution-item">
                  <div className="token-header">
                    <h5>{token}</h5>
                  </div>
                  <div className="distribution-details">
                    <div className="detail-row">
                      <label>Amount:</label>
                      <span className="amount">{data.parsed}</span>
                    </div>
                    <div className="detail-row">
                      <label>USD Value:</label>
                      <span className="usd-value">
                        $
                        {data.usdValue
                          ? parseFloat(data.usdValue).toFixed(8)
                          : "0.00"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <label>Last Updated:</label>
                      <span className="timestamp">
                        {data.lastUpdated
                          ? new Date(data.lastUpdated).toLocaleString()
                          : "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note Section */}
        {parsedData.note && (
          <div className="data-section note-section">
            <div className="section-header">
              <h4>Note</h4>
              {editingNote && noteContent !== originalNote && (
                <button
                  className="update-note-button"
                  onClick={handleUpdateNote}
                  disabled={updatingNote}
                >
                  {updatingNote ? "Updating..." : "Update Note"}
                </button>
              )}
            </div>

            <div className="note-content">
              <textarea
                className="note-input"
                value={noteContent}
                onChange={(e) => {
                  setNoteContent(e.target.value);
                  if (!editingNote) setEditingNote(true);
                }}
                placeholder="Enter your note here..."
                rows={4}
                disabled={updatingNote}
              />
            </div>
          </div>
        )}

        {/* Any other sections (excluding portfolio, requestType, timestamp, distributions, tokenPrices, calendar, weather, system, timezone, globals, date, localTimestamp, generatedAt) */}
        {Object.entries(parsedData)
          .filter(
            ([key]) =>
              ![
                "portfolio",
                "requestType",
                "timestamp",
                "distributions",
                "tokenPrices",
                "calendar",
                "weather",
                "system",
                "timezone",
                "globals",
                "date",
                "localTimestamp",
                "generatedAt",
                "note",
              ].includes(key)
          )
          .map(([key, value]) => (
            <div key={key} className="data-section">
              <h4>{key}</h4>
              {renderDataSection(value)}
            </div>
          ))}
      </div>
    );
  };

  if (!checkEnvironmentVariables()) {
    return (
      <div className="agent-manager">
        <div className="config-required">
          <h2>Configuration Required</h2>
          <p>
            Process IDs need to be configured to interact with your GUS
            assistant system.
          </p>
          <button className="configure-button" onClick={onShowEnvConfig}>
            Configure Process IDs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-manager">
      <div className="manager-card">
        <div className="manager-header">
          <h2>GUS Manager</h2>
          <div className="manager-actions">
            <button
              className="refresh-button"
              onClick={getAgentData}
              disabled={loading}
            >
              {loading ? "Loading..." : "Get GUS Data"}
            </button>
            <button className="config-button" onClick={onShowEnvConfig}>
              Configure
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {lastUpdated && (
          <div className="last-updated">Last updated: {lastUpdated}</div>
        )}

        <div className="agent-info">
          <h3>Process Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>GUS Agent Process ID:</label>
              <span>{envVars.AGENT_PROCESS_ID}</span>
            </div>
            <div className="info-item">
              <label>Relay Process ID:</label>
              <span>{envVars.RELAY_PROCESS_ID}</span>
            </div>
            <div className="info-item">
              <label>Crontroller Process ID:</label>
              <span>{envVars.CRONTROLLER_PROCESS_ID}</span>
            </div>
          </div>
        </div>

        {renderAgentData()}

        {/* Debug Section */}
        {parsedData && (
          <div className="debug-section">
            <details>
              <summary>🔍 Debug: Raw Agent Response Data</summary>
              <div className="debug-content">
                <pre>{JSON.stringify(parsedData, null, 2)}</pre>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentManager;
