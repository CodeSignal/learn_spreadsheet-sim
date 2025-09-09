# Spreadsheet Simulator

Spreadsheet simulation for CodeSignal

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Sheets API access (for JSON export functionality)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd learn_spreadsheet-sim
   ```

2. **Create environment configuration:**
   Create a `.env` file in the project root:
   ```env
   ORIGINAL_SPREADSHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/
   GOOGLE_API_KEY=your_google_docs_api_key
   GOOGLE_SHEET_ID=your_sheet_id
   GENERATED_TAG=your_generated_tag
   COPY_ENDPOINT=http://146.190.40.43:3000/getSpreadsheet
   ```

3. **Run the automated setup:**
   ```bash
   chmod +x start_spreadsheet.sh
   ./start_spreadsheet.sh
   ```

   This script will:
   - Install required dependencies (`dotenv`, `express`, `axios`)
   - Install PM2 globally for process management
   - Start the proxy server
   - Run the initial setup

## Components


### 🔧 Configuration

The application uses environment variables for configuration:

- `ORIGINAL_SPREADSHEET_URL` - The source Google Sheet URL to copy
- `GOOGLE_API_KEY` - Google Sheets API key for data export
- `COPY_ENDPOINT` - External service endpoint for creating sheet copies

## Usage

### Basic Operation

1. **Start the system:**
   ```bash
   ./start_spreadsheet.sh
   ```

2. **Access the proxy:**
   Navigate to `http://localhost:3000` in your browser

3. **Automatic redirection:**
   The proxy will show a loading page while preparing the sheet, then automatically redirect to the temporary copy
