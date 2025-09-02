import { useState, useEffect } from "react";
import "./EnvironmentConfig.css";

const EnvironmentConfig = ({ envVars, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    AGENT_PROCESS_ID: "",
    RELAY_PROCESS_ID: "",
    CRONTROLLER_PROCESS_ID: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setFormData(envVars);
  }, [envVars]);

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));

    // Clear error when user starts typing
    if (errors[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.AGENT_PROCESS_ID.trim()) {
      newErrors.AGENT_PROCESS_ID = "Agent Process ID is required";
    }

    if (!formData.RELAY_PROCESS_ID.trim()) {
      newErrors.RELAY_PROCESS_ID = "Relay Process ID is required";
    }

    if (!formData.CRONTROLLER_PROCESS_ID.trim()) {
      newErrors.CRONTROLLER_PROCESS_ID = "Crontroller Process ID is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className="environment-config">
      <div className="config-card">
        <h2>GUS Configuration</h2>
        <p>
          Configure the required process IDs to interact with your GUS assistant
          system
        </p>

        <div className="config-form">
          <div className="form-group">
            <label htmlFor="AGENT_PROCESS_ID">GUS Agent Process ID *</label>
            <input
              type="text"
              id="AGENT_PROCESS_ID"
              value={formData.AGENT_PROCESS_ID}
              onChange={(e) =>
                handleInputChange("AGENT_PROCESS_ID", e.target.value)
              }
              placeholder="Enter your GUS agent process ID"
              className={errors.AGENT_PROCESS_ID ? "error" : ""}
            />
            {errors.AGENT_PROCESS_ID && (
              <span className="error-message">{errors.AGENT_PROCESS_ID}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="RELAY_PROCESS_ID">Relay Process ID *</label>
            <input
              type="text"
              id="RELAY_PROCESS_ID"
              value={formData.RELAY_PROCESS_ID}
              onChange={(e) =>
                handleInputChange("RELAY_PROCESS_ID", e.target.value)
              }
              placeholder="Enter your relay process ID"
              className={errors.RELAY_PROCESS_ID ? "error" : ""}
            />
            {errors.RELAY_PROCESS_ID && (
              <span className="error-message">{errors.RELAY_PROCESS_ID}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="CRONTROLLER_PROCESS_ID">
              Crontroller Process ID *
            </label>
            <input
              type="text"
              id="CRONTROLLER_PROCESS_ID"
              value={formData.CRONTROLLER_PROCESS_ID}
              onChange={(e) =>
                handleInputChange("CRONTROLLER_PROCESS_ID", e.target.value)
              }
              placeholder="Enter your crontroller process ID"
              className={errors.CRONTROLLER_PROCESS_ID ? "error" : ""}
            />
            {errors.CRONTROLLER_PROCESS_ID && (
              <span className="error-message">
                {errors.CRONTROLLER_PROCESS_ID}
              </span>
            )}
          </div>
        </div>

        <div className="config-actions">
          <button className="save-button" onClick={handleSave}>
            Save Configuration
          </button>
          <button className="cancel-button" onClick={handleCancel}>
            Cancel
          </button>
        </div>

        <div className="config-info">
          <h3>About these process IDs:</h3>
          <ul>
            <li>
              <strong>GUS Agent Process ID:</strong> The AO process ID of your
              GUS assistant
            </li>
            <li>
              <strong>Relay Process ID:</strong> The AO process ID of your relay
              process
            </li>
            <li>
              <strong>Crontroller Process ID:</strong> The AO process ID of your
              crontroller process
            </li>
          </ul>
          <p className="note">
            <strong>Note:</strong> These values are stored locally in your
            browser and are not sent to any server.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentConfig;
