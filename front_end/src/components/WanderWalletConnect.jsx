import { useState } from "react";
import "./WanderWalletConnect.css";

const WanderWalletConnect = ({ onConnect }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connectWallet = async () => {
    if (!window.arweaveWallet) {
      setError(
        "Wander wallet extension not detected. Please install it first."
      );
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Get default permissions from environment or use defaults
      const defaultPermissions =
        import.meta.env.VITE_DEFAULT_PERMISSIONS?.split(",") || [
          "ACCESS_ADDRESS",
          "ACCESS_PUBLIC_KEY",
          "SIGN_TRANSACTION",
        ];

      // Connect to Wander wallet with permissions
      await window.arweaveWallet.connect(defaultPermissions, {
        name: import.meta.env.VITE_APP_NAME || "GUS - Personal AO Assistant",
        logo: "https://arweave.net/jAvd7Z1CBd8gVF2D6ESj7SMCCUYxDX_z3vpp5aHdaYk",
      });

      // Get wallet information
      const address = await window.arweaveWallet.getActiveAddress();
      const publicKey = await window.arweaveWallet.getActivePublicKey();

      if (address && publicKey) {
        onConnect(address, publicKey);
      } else {
        throw new Error("Failed to get wallet information");
      }
    } catch (err) {
      console.error("Wallet connection error:", err);
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="wander-wallet-connect">
      <div className="connect-card">
        <h2>Connect Your Wallet</h2>
        <p>Connect your Wander wallet to interact with GUS</p>

        {error && <div className="error-message">{error}</div>}

        <button
          className="connect-button"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting..." : "Connect Wander Wallet"}
        </button>

        <div className="wallet-info">
          <h3>Required Permissions:</h3>
          <ul>
            <li>ACCESS_ADDRESS - Read wallet address</li>
            <li>ACCESS_PUBLIC_KEY - Read public key</li>
            <li>SIGN_TRANSACTION - Sign transactions</li>
          </ul>
        </div>

        <div className="install-info">
          <p>
            <strong>Don't have Wander?</strong>{" "}
            <a
              href="https://wander.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install the extension
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default WanderWalletConnect;
