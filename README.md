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

2. Edit `relay_monitor/.env` and update the following **required** fields:

   ```env
   # API Keys (REQUIRED - update these)
   BREVO_API_KEY=your_brevo_api_key_here
   OPENWEATHER_API_KEY=your_openweather_api_key_here

   # Email Configuration (REQUIRED - update these)
   EMAIL_TO_ADDRESS=email@email.com
   EMAIL_TO_NAME=Stephen
   EMAIL_SENDER_ADDRESS=emailSender@email.com

   # AO Wallet Configuration (update if different)
   AO_WALLET_PATH=~/.aos.json
   ```

   **Important**: Leave all placeholder values (like `wouldnt-you-like-to-know`, `preConfiguredEmailAddress`, etc.) unchanged unless you also modify the corresponding agent code. The process IDs in the example file are already configured.

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

2. Edit `utilities/.env` and update with your values:

   ```env
   # AO Process IDs (update with your actual process IDs)
   AGENT_PROCESS_ID = "your-agent-process-id"
   RELAY_PROCESS_ID = "your-relay-process-id"
   CRONTROLLER_PROCESS_ID = "your-crontroller-process-id"

   # User Configuration
   USER_WALLET_ADDRESS = "your-wallet-address"
   WALLET_PATH = ~/.aos.json

   # Weather Configuration
   WEATHER_LOCATION = New York, NY
   ```

   **Note**: The example file contains real process IDs that should be replaced with your own.

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
   cp front_end/env.example front_end/.env
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

- `BREVO_API_KEY`: Brevo email service API key (replace `your_brevo_api_key_here`)
- `OPENWEATHER_API_KEY`: OpenWeather API key (replace `your_openweather_api_key_here`)
- `EMAIL_TO_ADDRESS`: Your email address (replace `email@email.com`)
- `EMAIL_TO_NAME`: Your name (replace `Stephen`)
- `EMAIL_SENDER_ADDRESS`: Sender email address (replace `emailSender@email.com`)

**Optional Updates:**

- `AO_WALLET_PATH`: Path to your AO wallet file (if different from `~/.aos.json`)
- `MOCK_RELAY_PROCESS_ID`: Your relay process ID (if different from example)
- `CRONTROLLER_PROCESS_ID`: Your crontroller process ID (if different from example)

**Do NOT Change (unless modifying agent code):**

- All placeholder values (e.g., `wouldnt-you-like-to-know`, `preConfiguredEmailAddress`, etc.)
- Timing configuration values (`CHECK_INTERVAL`, `GRAPHQL_FAILURE_DELAY`, etc.)
- Gus price API configuration (`GUS_PRICE_REQUIRED_BEARER_TOKEN`, `VENTO_RETRY_LIMIT`, etc.)
- AO Network configuration URLs (`GATEWAY_URL`, `MU_URL`, `CU_URL`)

#### Utilities (.env)

**Required Updates:**

- `AGENT_PROCESS_ID`: Your agent process ID (replace example value)
- `RELAY_PROCESS_ID`: Your relay process ID (replace example value)
- `CRONTROLLER_PROCESS_ID`: Your crontroller process ID (replace example value)
- `USER_WALLET_ADDRESS`: Your wallet address (replace example value)

**Optional Updates:**

- `WALLET_PATH`: Path to your wallet file (if different from `~/.aos.json`)
- `WEATHER_LOCATION`: Your location for weather updates (if different from `New York, NY`)

**Note**: The example file contains real process IDs that should be replaced with your own.

#### Frontend (.env)

- `VITE_AGENT_PROCESS_ID`: Your agent process ID
- `VITE_RELAY_PROCESS_ID`: Your relay process ID
- `VITE_CRONTROLLER_PROCESS_ID`: Your crontroller process ID

## 📝 License

This project is licensed under the GNU Affero General Public License v3.0. See the LICENSE file for details.

**Note**: This setup process may take some time, especially for the initial data processing. Be patient and ensure all services are running properly before testing functionality.
