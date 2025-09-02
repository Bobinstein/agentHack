# AgentHack - Personal AO Assistant

A comprehensive personal assistant built on the AO (Autonomous Objects) network that provides email management, weather updates, calendar integration, and more.

## 🚀 Quick Setup Guide

Follow these steps to get your AgentHack assistant up and running:

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager
- AO wallet file
- Free API keys for Brevo and OpenWeather

### Step 1: Obtain API Keys

1. **Brevo Email Service**: Sign up at [https://onboarding.brevo.com/account/register](https://onboarding.brevo.com/account/register)

   - Create a free account
   - Generate an API key from your dashboard

2. **OpenWeather API**: Sign up at [https://home.openweathermap.org/users/sign_up](https://home.openweathermap.org/users/sign_up)
   - Create a free account
   - Generate an API key from your account settings

### Step 2: Configure Relay Monitor

1. Copy the environment template:

   ```bash
   cp relay_monitor/.env.example relay_monitor/.env
   ```

2. Edit `relay_monitor/.env` and fill in the following:

   ```env
   # AO Process IDs (will be filled in step 4)
   MOCK_RELAY_PROCESS_ID="your-relay-process-id"
   CRONTROLLER_PROCESS_ID="your-crontroller-process-id"

   # API Keys (REQUIRED - update these)
   BREVO_API_KEY="your-brevo-api-key-here"
   OPENWEATHER_API_KEY="your-openweather-api-key-here"

   # Email Configuration (REQUIRED - update these)
   EMAIL_TO_ADDRESS="your-email@example.com"
   EMAIL_TO_NAME="Your Name"
   EMAIL_SENDER_ADDRESS="sender@example.com"

   # AO Wallet Configuration (update if different)
   AO_WALLET_PATH="~/.aos.json"
   ```

   **Important**: Leave all placeholder values (like `wouldnt-you-like-to-know`, `preConfiguredEmailAddress`, etc.) unchanged unless you also modify the corresponding agent code.

### Step 3: Create AO Processes

Create 3 AO processes with the following specifications:

1. **Agent Process**: Load `agent/main.lua`
2. **Relay Process**: Load `relay_process/mock_relay.lua`
3. **Crontroller Process**: Load `crontroller/crontroller.lua` with **1 minute cron interval**

Use legacynet for all 3 processes.

### Step 4: Update Process IDs

1. Update `relay_monitor/.env` with your process IDs:
   ```env
   MOCK_RELAY_PROCESS_ID="your-relay-process-id"
   CRONTROLLER_PROCESS_ID="your-crontroller-process-id"
   ```

### Step 5: Configure Utilities

1. Copy the utilities environment template:

   ```bash
   cp utilities/.env.example utilities/.env
   ```

2. Edit `utilities/.env` and fill in:

   ```env
   # AO Process IDs
   AGENT_PROCESS_ID="your-agent-process-id"
   RELAY_PROCESS_ID="your-relay-process-id"
   CRONTROLLER_PROCESS_ID="your-crontroller-process-id"

   # User Configuration
   USER_WALLET_ADDRESS="your-wallet-address"
   WALLET_PATH="~/.aos.json"

   # Weather Configuration
   WEATHER_LOCATION="New York,NY,US"
   ```

### Step 6: Install Dependencies

Install dependencies in all three directories:

```bash
# Relay Monitor
cd relay_monitor
yarn install

# Frontend
cd ../front_end
yarn install

# Utilities
cd ../utilities
yarn install

cd ..
```

### Step 7: Start the Relay Monitor

```bash
cd relay_monitor
yarn start
```

Keep this running in a terminal window.

### Step 8: Run Initial Setup

```bash
cd utilities
node getStarted.js
```

This script will initialize your agent with basic configuration.

### Step 9: Configure Frontend

1. Copy the frontend environment template:

   ```bash
   cp front_end/.env.example front_end/.env
   ```

2. Edit `front_end/.env` and fill in:

   ```env
   VITE_APP_NAME="GUS - Personal AO Assistant"
   VITE_APP_DESCRIPTION="Your personal AO assistant, brought to you by Giga Utility Services"
   VITE_ARWEAVE_GATEWAY="https://arweave.net"
   VITE_DEFAULT_PERMISSIONS="ACCESS_ADDRESS,ACCESS_PUBLIC_KEY,SIGN_TRANSACTION"

   # Process IDs
   VITE_AGENT_PROCESS_ID="your-agent-process-id"
   VITE_RELAY_PROCESS_ID="your-relay-process-id"
   VITE_CRONTROLLER_PROCESS_ID="your-crontroller-process-id"
   ```

### Step 10: Start the Frontend

```bash
cd front_end
yarn dev
```

Your AgentHack assistant will be available at `http://localhost:3000`

### Step 11: Initial Processing

⚠️ **Important**: Functionality that requires HTTP calls can take up to 40 minutes to fully process. Be patient while all initial data processes are completed.

## 📁 Project Structure

```
agentHack/
├── agent/                 # Main agent logic (Lua)
│   ├── main.lua          # Core agent functionality
│   ├── emails.lua        # Email management
│   ├── weather.lua       # Weather integration
│   ├── calendar.lua      # Calendar management
│   ├── notes.lua         # Note-taking
│   ├── tokens.lua        # Token management
│   └── setCrons.lua      # Cron job setup
├── crontroller/          # Cron job controller
│   └── crontroller.lua   # Cron management logic
├── relay_monitor/        # HTTP relay monitor
│   ├── relay_monitor.js  # Main monitoring script
│   └── package.json      # Dependencies
├── relay_process/        # Mock relay process
│   └── mock_relay.lua    # Relay logic
├── front_end/            # React frontend
│   ├── src/              # Source code
│   └── package.json      # Dependencies
└── utilities/            # Setup and utility scripts
    ├── getStarted.js     # Initial setup script
    ├── addPortfolio.js   # Portfolio management
    ├── setNote.js        # Note management
    └── package.json      # Dependencies
```

## 🔧 Configuration Details

### Environment Variables

#### Relay Monitor (.env)

**Required Updates:**

- `MOCK_RELAY_PROCESS_ID`: Your relay process ID
- `CRONTROLLER_PROCESS_ID`: Your crontroller process ID
- `BREVO_API_KEY`: Brevo email service API key
- `OPENWEATHER_API_KEY`: OpenWeather API key
- `EMAIL_TO_ADDRESS`: Your email address
- `EMAIL_TO_NAME`: Your name
- `EMAIL_SENDER_ADDRESS`: Sender email address

**Optional Updates:**

- `AO_WALLET_PATH`: Path to your AO wallet file (if different from `~/.aos.json`)

**Do NOT Change (unless modifying agent code):**

- All placeholder values (e.g., `wouldnt-you-like-to-know`, `preConfiguredEmailAddress`, etc.)
- Timing configuration values
- Gus price API configuration
- AO Network configuration URLs

#### Utilities (.env)

- `AGENT_PROCESS_ID`: Your agent process ID
- `RELAY_PROCESS_ID`: Your relay process ID
- `CRONTROLLER_PROCESS_ID`: Your crontroller process ID
- `USER_WALLET_ADDRESS`: Your wallet address
- `WALLET_PATH`: Path to your wallet file
- `WEATHER_LOCATION`: Your location for weather updates

#### Frontend (.env)

- `VITE_AGENT_PROCESS_ID`: Your agent process ID
- `VITE_RELAY_PROCESS_ID`: Your relay process ID
- `VITE_CRONTROLLER_PROCESS_ID`: Your crontroller process ID

## 🚨 Troubleshooting

### Common Issues

1. **Process IDs not working**: Ensure all process IDs are correctly copied and pasted
2. **API keys not working**: Verify your API keys are valid and have proper permissions
3. **Relay monitor not starting**: Check that all environment variables are set
4. **Frontend not connecting**: Ensure the relay monitor is running and process IDs are correct

### Getting Help

- Check the console output for error messages
- Verify all environment variables are set correctly
- Ensure your AO wallet has sufficient credits
- Check that all processes are running and accessible

## 📝 License

This project is licensed under the GNU Affero General Public License v3.0. See the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

**Note**: This setup process may take some time, especially for the initial data processing. Be patient and ensure all services are running properly before testing functionality.
