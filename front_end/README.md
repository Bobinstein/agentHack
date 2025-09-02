# GUS - Personal AO Assistant

A modern React frontend application for GUS (your personal AO assistant), built using Vite and brought to you by Giga Utility Services.

## Features

- 🚀 **Vite-powered** - Fast development and build times
- 🔗 **Wander Wallet Integration** - Connect to Arweave wallets using the Wander extension
- 🎨 **Modern UI** - Beautiful, responsive design with crypto/scifi/matrix theme
- 📱 **Mobile Responsive** - Works seamlessly on all device sizes
- ⚙️ **Environment Configuration** - Easy configuration via .env files
- 🔐 **Permission Management** - Request specific wallet permissions as needed
- 🤖 **GUS Integration** - Connect to your personal AO assistant

## Prerequisites

- Node.js (v16 or higher)
- Wander wallet extension installed in your browser
- Git

## Installation

1. **Clone the repository** (if not already done):

   ```bash
   cd front_end
   ```

2. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**:

   ```bash
   cp env.example .env
   ```

   Edit the `.env` file with your desired configuration:

   ```env
   VITE_APP_NAME="GUS - Personal AO Assistant"
   VITE_APP_DESCRIPTION="Your personal AO assistant, brought to you by Giga Utility Services"
   VITE_ARWEAVE_GATEWAY="https://arweave.net"
   VITE_DEFAULT_PERMISSIONS="ACCESS_ADDRESS,ACCESS_PUBLIC_KEY,SIGN_TRANSACTION"

   # Process IDs
   VITE_AGENT_PROCESS_ID=""
   VITE_RELAY_PROCESS_ID=""
   VITE_CRONTROLLER_PROCESS_ID=""
   ```

## Development

1. **Start the development server**:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Open your browser** and navigate to `http://localhost:3000`

3. **Install Wander wallet extension** if you haven't already:
   - Visit [wander.app](https://wander.app)
   - Install the browser extension
   - Create or import a wallet

## Building for Production

1. **Build the application**:

   ```bash
   npm run build
   # or
   yarn build
   ```

2. **Preview the production build**:

   ```bash
   npm run preview
   # or
   yarn preview
   ```

## Wander Wallet Integration

This application integrates with the Wander wallet extension using the official API documented at [docs.wander.app/api/connect](https://docs.wander.app/api/connect).

### Required Permissions

The application requests the following permissions by default:

- `ACCESS_ADDRESS` - Read the active wallet address
- `ACCESS_PUBLIC_KEY` - Read the active wallet's public key
- `SIGN_TRANSACTION` - Sign Arweave transactions

### Customizing Permissions

You can modify the requested permissions by updating the `VITE_DEFAULT_PERMISSIONS` environment variable or editing the `WanderWalletConnect.jsx` component.

Available permissions include:

- `ACCESS_ADDRESS`
- `ACCESS_PUBLIC_KEY`
- `ACCESS_ALL_ADDRESSES`
- `SIGN_TRANSACTION`
- `ENCRYPT`
- `DECRYPT`
- `SIGNATURE`
- `ACCESS_ARWEAVE_CONFIG`
- `DISPATCH`
- `ACCESS_TOKENS`

## GUS Assistant Integration

This frontend is designed to work with GUS (your personal AO assistant) and integrates with the AO ecosystem using `@permaweb/aoconnect`.

### Process Configuration

The application requires three process IDs to function:

- **GUS Agent Process ID** - Your main GUS assistant process
- **Relay Process ID** - Your relay process for communication
- **Crontroller Process ID** - Your crontroller process for scheduling

### Data Display

The frontend automatically parses and displays data from your GUS assistant, including:

- Portfolio information and token balances
- Raw portfolio details
- Request types and other agent data

## Project Structure

```
front_end/
├── src/
│   ├── components/
│   │   ├── WanderWalletConnect.jsx    # Wallet connection component
│   │   ├── WanderWalletConnect.css    # Connection component styles
│   │   ├── AgentManager.jsx           # GUS manager component
│   │   ├── AgentManager.css           # Manager styles
│   │   ├── EnvironmentConfig.jsx      # Process ID configuration
│   │   └── EnvironmentConfig.css      # Configuration styles
│   ├── App.jsx                        # Main application component
│   ├── App.css                        # Main application styles
│   ├── main.jsx                       # Application entry point
│   └── index.css                      # Global styles
├── public/                            # Static assets
├── package.json                       # Dependencies and scripts
├── vite.config.js                     # Vite configuration
├── env.example                        # Environment variables template
└── README.md                          # This file
```

## Customization

### Styling

The application uses a dark crypto/scifi/matrix theme with neon green accents. You can modify the styles in the respective `.css` files to match your brand or design preferences.

### Environment Variables

All configuration is done through environment variables. See the `env.example` file for available options.

### Adding New Features

The component-based architecture makes it easy to add new features. Simply create new components in the `src/components/` directory and import them into `App.jsx`.

## Troubleshooting

### Wander Wallet Not Detected

- Ensure the Wander extension is installed and enabled
- Refresh the page after installing the extension
- Check browser console for any error messages

### Connection Issues

- Verify you have the correct permissions enabled in Wander
- Check that your wallet is unlocked
- Ensure you're on a supported network (mainnet/testnet)

### GUS Integration Issues

- Verify all three process IDs are correctly configured
- Check that your GUS assistant is running and accessible
- Ensure the process IDs match your deployed AO processes

### Build Issues

- Clear `node_modules` and reinstall dependencies
- Ensure you're using a compatible Node.js version
- Check for any TypeScript or linting errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the same license as the parent repository.

## Support

For issues related to:

- **Wander Wallet**: Visit [wander.app](https://wander.app) or their [documentation](https://docs.wander.app)
- **Arweave**: Check the [Arweave documentation](https://docs.arweave.org)
- **AO Ecosystem**: Visit the [AO documentation](https://docs.arweave.org/develop/ao/overview)
- **GUS Assistant**: Contact Giga Utility Services
- **This Application**: Open an issue in the repository

## About Giga Utility Services

GUS (your personal AO assistant) is brought to you by Giga Utility Services, providing intelligent automation and assistance in the Arweave ecosystem.
