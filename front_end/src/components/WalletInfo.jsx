import "./WalletInfo.css";

const WalletInfo = ({ address, publicKey, onDisconnect }) => {
  const formatAddress = (addr) => {
    if (!addr) return "N/A";
    return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
  };

  const formatPublicKey = (key) => {
    if (!key) return "N/A";
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log("Copied to clipboard");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="wallet-info">
      <div className="info-card">
        <h2>Wallet Connected</h2>

        <div className="info-section">
          <h3>Address</h3>
          <div className="info-row">
            <code className="info-value">{formatAddress(address)}</code>
            <button
              className="copy-button"
              onClick={() => copyToClipboard(address)}
              title="Copy full address"
            >
              📋
            </button>
          </div>
          <small className="full-value">{address}</small>
        </div>

        <div className="info-section">
          <h3>Public Key</h3>
          <div className="info-row">
            <code className="info-value">{formatPublicKey(publicKey)}</code>
            <button
              className="copy-button"
              onClick={() => copyToClipboard(publicKey)}
              title="Copy full public key"
            >
              📋
            </button>
          </div>
          <small className="full-value">{publicKey}</small>
        </div>

        <div className="info-section">
          <h3>Gateway</h3>
          <p className="info-value">
            {import.meta.env.VITE_ARWEAVE_GATEWAY || "https://arweave.net"}
          </p>
        </div>

        <button className="disconnect-button" onClick={onDisconnect}>
          Disconnect Wallet
        </button>
      </div>
    </div>
  );
};

export default WalletInfo;
