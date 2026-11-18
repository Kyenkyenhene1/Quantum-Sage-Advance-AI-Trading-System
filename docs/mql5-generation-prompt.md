
# Prompt for Generating the QuantumSage MQL5 Expert Advisor

## --- Role & Goal ---
You are an expert MQL5 programmer with extensive experience in creating complex, multi-strategy Expert Advisors (EAs) that include web communication for external dashboard control.

Your goal is to create a single, complete, and production-quality MQL5 file for an Expert Advisor named "QuantumSage". This EA must implement all the strategies, risk management rules, and communication protocols specified below, which correspond to a web-based dashboard.

## --- Core Requirements ---

### 1. Input Parameters (`input` variables)
The EA must expose the following parameters so they can be controlled from the dashboard via API calls:

- **Operation Modes**:
  - `input bool enableMlCore = true;` // Enable/disable the Machine Learning strategy.
  - `input bool enableRoyalStructure = false;` // Enable/disable the Royal Structure strategy.
  - `input bool enableKyenkyenheneHybrid = false;` // Enable/disable the Kyenkyenhene Hybrid strategy.

- **Risk Management**:
  - `input double riskPerTradePercent = 2.0;` // The percentage of account balance to risk per trade.
  - `input int maxDailyTrades = 10;` // Maximum number of trades to open in a single day.
  - `input string takeProfitRatio = "1:2";` // Risk-to-reward ratio (e.g., "1:1.5", "1:2", "1:500").
  - `input bool useDynamicStopLoss = true;` // Master switch for dynamic SL.

- **Trade Management**:
  - `input bool enableLayering = true;` // Enable/disable layered entries.
  - `input int layeringPips_1 = 30;` // Pips for 1st layer.
  - `input int layeringPips_2 = 50;` // Pips for 2nd layer.
  - `input int layeringPips_3 = 70;` // Pips for 3rd layer.
  - `input int layeringPips_4 = 100;` // Pips for 4th layer.
  - `input int breakevenPips = 20;` // Pips in profit to move Stop Loss to Break Even.

- **Filters**:
  - `input bool enableNewsFilter = true;` // Pause trading during high-impact news.
  - `input bool enableVolumeSpikeFilter = false;` // Pause trading on abnormal volume spikes.

- **Web Communication**:
  - `input int webServerPort = 8080;` // Port for the built-in web server.
  - `input string apiSecretKey = "your-secret-key";` // A secret key to authenticate API requests.

- **Magic Number**:
  - `input int magicNumber = 931616;` // Unique identifier for trades managed by this EA.


### 2. Core Trading Logic (`OnTick` function)
The `OnTick()` function should be the main loop. On each new tick, it should perform the following sequence:

1.  **Check Filters**: Check if trading is paused due to the News or Volume Spike filters. If so, do not proceed with new trade logic.
2.  **Check Max Daily Trades**: If the number of trades opened today exceeds `maxDailyTrades`, do not open new trades.
3.  **Manage Existing Trades**: Call functions to manage stop losses (including moving to breakeven) and take profits for currently open trades. Also, check for layering opportunities.
4.  **Check for New Signals**: Iterate through the enabled strategies. If a valid `Buy` or `Sell` signal is returned from any enabled strategy function, proceed to open a trade.
5.  **Open Trade**: Before opening a trade, calculate the correct lot size based on `riskPerTradePercent` and the required stop loss distance. Execute the trade with the calculated SL/TP, magic number, and a comment specifying which strategy generated the signal (e.g., "QuantumSage: ML Core").

### 3. Strategy Implementation
Create separate functions for each trading strategy. These functions should return a simple signal (e.g., `1` for Buy, `-1` for Sell, `0` for No Signal).

- **`checkMlCoreSignal()`**: **(Placeholder Logic)** Since the ML model is external, this function will simulate receiving a signal. For now, implement a simple crossover of two EMAs (e.g., 9-period and 21-period) as a placeholder for the ML signal.
- **`checkRoyalStructureSignal()`**: Implement logic to identify Market Structure Shifts (MSS) and bearish/bullish Order Blocks (OB). A buy signal is generated when price retraces to a bullish OB after a bullish MSS. A sell signal is the opposite.
- **`checkKyenkyenheneHybridSignal()`**: This is the most complex strategy. It must identify the following confluences:
    1.  A **Liquidity Sweep** (taking out a recent high or low).
    2.  A **Market Structure Shift** (MSS) after the sweep.
    3.  A **Fair Value Gap (FVG)** or **Order Block (OB)** created during the MSS.
    4.  A signal is generated when the price retraces back into this FVG or OB.

### 4. Risk & Trade Management

- **`calculateLotSize(double stopLossPips)`**: This crucial function must calculate the correct lot size that respects the `riskPerTradePercent` input. It should use the account balance, the risk percentage, and the stop loss distance in pips to determine the trade volume.
- **`calculateStopLossPips(int signalType)`**: Implement logic for the different stop loss types. If `useDynamicStopLoss` is true, it should cycle through different methods (e.g., ATR-based, Structure-based). For this prompt, you can use a fixed pip value or a simple ATR-based calculation as a starting point.
- **`calculateTakeProfitPips(double stopLossPips)`**: This function should parse the `takeProfitRatio` string (e.g., "1:2") and calculate the take profit in pips based on the stop loss.
- **`manageBreakeven()`**: For any open trade, if its profit exceeds `breakevenPips`, this function should modify its stop loss to the entry price.
- **`manageLayering()`**: For an initial open trade that is in profit, check if it has reached one of the `layeringPips` thresholds. If so, open a new trade in the same direction. A single initial trade can have up to 4 additional layered entries.

### 5. Web Server and API (Crucial for Dashboard Communication)

- **`OnChartEvent()`**: Use this function to handle web requests. MQL5's web server runs inside this event.
- **Start Web Server**: In `OnInit()`, start a simple web server on the specified `webServerPort`.
- **API Endpoints**: The server must handle `POST` requests to the following endpoints. All requests should be authenticated using the `apiSecretKey`.
    - `/api/status`: Returns a JSON object with the EA's current status, active trades, account details (balance, equity), and system logs.
    - `/api/update-settings`: Accepts a JSON payload with new values for the `input` parameters and updates the running EA's configuration.
    - `/api/start-bot`: A command to start the trading logic.
    - `/api/stop-bot`: A command to pause the trading logic.

### 6. System Logging
Create a global log array and a helper function `addLog(string message, string level)` to add new log entries. These logs should be exposed via the `/api/status` endpoint. Log key events like EA initialization, trade opening/closing, settings changes, and errors.

## --- Output Format ---
Please provide the complete code in a single MQL5 file (`.mq5`). Ensure the code is well-structured, commented, and follows best practices for MQL5 development, including proper error handling for all trading and web functions.
