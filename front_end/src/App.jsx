import { useState, useEffect } from "react";
import "./App.css";
import WanderWalletConnect from "./components/WanderWalletConnect";
import AgentManager from "./components/AgentManager";
import EnvironmentConfig from "./components/EnvironmentConfig";

function App() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletPublicKey, setWalletPublicKey] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [envVars, setEnvVars] = useState({});
  const [showEnvConfig, setShowEnvConfig] = useState(false);

  useEffect(() => {
    // Check if Wander wallet is available
    if (window.arweaveWallet) {
      console.log("Wander wallet detected");
    } else {
      console.log("Wander wallet not detected - please install the extension");
    }

    // Check environment variables
    checkEnvironmentVariables();
  }, []);

  const checkEnvironmentVariables = () => {
    const requiredVars = {
      AGENT_PROCESS_ID: import.meta.env.VITE_AGENT_PROCESS_ID,
      RELAY_PROCESS_ID: import.meta.env.VITE_RELAY_PROCESS_ID,
      CRONTROLLER_PROCESS_ID: import.meta.env.VITE_CRONTROLLER_PROCESS_ID,
    };

    const missingVars = Object.entries(requiredVars).filter(
      ([key, value]) => !value
    );

    if (missingVars.length > 0) {
      setShowEnvConfig(true);
    }

    setEnvVars(requiredVars);
  };

  const handleWalletConnect = async (address, publicKey) => {
    setWalletAddress(address);
    setWalletPublicKey(publicKey);
    setIsConnected(true);
  };

  const handleWalletDisconnect = () => {
    setWalletAddress(null);
    setWalletPublicKey(null);
    setIsConnected(false);
  };

  const handleEnvConfigSave = (newEnvVars) => {
    setEnvVars(newEnvVars);
    setShowEnvConfig(false);
  };

  const handleEnvConfigCancel = () => {
    setShowEnvConfig(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>
          {import.meta.env.VITE_APP_NAME || "GUS - Personal AO Assistant"}
        </h1>
        <p>
          {import.meta.env.VITE_APP_DESCRIPTION ||
            "Your personal AO assistant, brought to you by Giga Utility Services"}
        </p>
      </header>

      <main className="App-main">
        {showEnvConfig ? (
          <EnvironmentConfig
            envVars={envVars}
            onSave={handleEnvConfigSave}
            onCancel={handleEnvConfigCancel}
          />
        ) : !isConnected ? (
          <WanderWalletConnect onConnect={handleWalletConnect} />
        ) : (
          <div className="connected-state">
            <AgentManager
              walletAddress={walletAddress}
              envVars={envVars}
              onShowEnvConfig={() => setShowEnvConfig(true)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
