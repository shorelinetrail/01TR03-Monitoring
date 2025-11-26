#ifndef WEB_PAGES_H
#define WEB_PAGES_H

// ============================================================================
// 01TR03 Transformer Monitoring System - Web Configuration Pages
// HTML templates for AP mode configuration
// ============================================================================

const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>01TR03 Setup</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            color: #fff;
            padding: 20px;
        }
        .container {
            max-width: 480px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 5px;
        }
        .header p {
            color: #888;
            font-size: 14px;
        }
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .card h2 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 20px;
            color: #4fc3f7;
        }
        .form-group {
            margin-bottom: 16px;
        }
        .form-group label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 6px;
            color: #aaa;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .form-group input, .form-group select {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            background: rgba(0,0,0,0.3);
            color: #fff;
            font-size: 16px;
            transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #4fc3f7;
        }
        .form-group input::placeholder {
            color: #666;
        }
        .form-row {
            display: flex;
            gap: 12px;
        }
        .form-row .form-group {
            flex: 1;
        }
        .btn {
            width: 100%;
            padding: 14px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.1s, box-shadow 0.2s;
        }
        .btn-primary {
            background: linear-gradient(135deg, #4fc3f7, #29b6f6);
            color: #000;
        }
        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(79, 195, 247, 0.4);
        }
        .btn-secondary {
            background: rgba(255,255,255,0.1);
            color: #fff;
            margin-top: 10px;
        }
        .status {
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .status.success {
            background: rgba(76, 175, 80, 0.2);
            border: 1px solid rgba(76, 175, 80, 0.3);
            color: #81c784;
        }
        .status.error {
            background: rgba(244, 67, 54, 0.2);
            border: 1px solid rgba(244, 67, 54, 0.3);
            color: #e57373;
        }
        .info-box {
            background: rgba(255, 193, 7, 0.1);
            border: 1px solid rgba(255, 193, 7, 0.2);
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 13px;
            color: #ffd54f;
            margin-top: 16px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 12px;
        }
        @media (max-width: 480px) {
            body { padding: 10px; }
            .card { padding: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>01TR03 Transformer Monitor</h1>
            <p>66/11kV 50MVA Power Transformer</p>
        </div>

        <div id="status"></div>

        <form id="configForm" action="/save" method="POST">
            <div class="card">
                <h2>📶 WiFi Configuration</h2>
                <div class="form-group">
                    <label>Network Name (SSID)</label>
                    <input type="text" name="wifi_ssid" id="wifi_ssid" required
                           placeholder="Enter WiFi network name" maxlength="64">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" name="wifi_pass" id="wifi_pass"
                           placeholder="Enter WiFi password" maxlength="64">
                </div>
                <button type="button" class="btn btn-secondary" onclick="scanNetworks()">
                    Scan Networks
                </button>
            </div>

            <div class="card">
                <h2>☁️ Cloud Configuration</h2>
                <div class="form-group">
                    <label>Supabase URL</label>
                    <input type="url" name="supa_url" id="supa_url"
                           placeholder="https://xxxxx.supabase.co" maxlength="255">
                </div>
                <div class="form-group">
                    <label>Supabase Anon Key</label>
                    <input type="text" name="supa_key" id="supa_key"
                           placeholder="eyJhbGciOiJIUzI1NiIs..." maxlength="255">
                </div>
                <div class="info-box">
                    Leave empty to run in standalone mode without cloud reporting.
                </div>
            </div>

            <div class="card">
                <h2>🌡️ Temperature Thresholds</h2>
                <p style="color: #888; font-size: 13px; margin-bottom: 16px;">
                    Set warning and alarm thresholds for temperature monitoring.
                </p>

                <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #fff;">
                    Main Tank (°C)
                </label>
                <div class="form-row">
                    <div class="form-group">
                        <label>Warning</label>
                        <input type="number" name="main_warn" id="main_warn"
                               value="85" min="0" max="150" step="0.5">
                    </div>
                    <div class="form-group">
                        <label>Alarm</label>
                        <input type="number" name="main_alarm" id="main_alarm"
                               value="95" min="0" max="150" step="0.5">
                    </div>
                </div>

                <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 12px; margin-top: 8px; color: #fff;">
                    Tap Changer (°C)
                </label>
                <div class="form-row">
                    <div class="form-group">
                        <label>Warning</label>
                        <input type="number" name="tap_warn" id="tap_warn"
                               value="70" min="0" max="150" step="0.5">
                    </div>
                    <div class="form-group">
                        <label>Alarm</label>
                        <input type="number" name="tap_alarm" id="tap_alarm"
                               value="85" min="0" max="150" step="0.5">
                    </div>
                </div>
            </div>

            <button type="submit" class="btn btn-primary">Save & Connect</button>
        </form>

        <div class="footer">
            <p>Firmware v%FIRMWARE_VERSION%</p>
            <p>MAC: %MAC_ADDRESS%</p>
        </div>
    </div>

    <script>
        function showStatus(message, type) {
            const status = document.getElementById('status');
            status.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
        }

        function scanNetworks() {
            showStatus('Scanning for networks...', 'info');
            fetch('/scan')
                .then(r => r.json())
                .then(data => {
                    if (data.networks && data.networks.length > 0) {
                        let select = '<select name="wifi_ssid" id="wifi_ssid" onchange="this.form.wifi_ssid.value=this.value">';
                        data.networks.forEach(n => {
                            select += '<option value="' + n.ssid + '">' + n.ssid + ' (' + n.rssi + ' dBm)</option>';
                        });
                        select += '</select>';
                        document.querySelector('input[name="wifi_ssid"]').outerHTML = select;
                        showStatus('Found ' + data.networks.length + ' networks', 'success');
                    } else {
                        showStatus('No networks found', 'error');
                    }
                })
                .catch(e => showStatus('Scan failed: ' + e, 'error'));
        }

        document.getElementById('configForm').addEventListener('submit', function(e) {
            e.preventDefault();
            showStatus('Saving configuration...', 'info');

            const formData = new FormData(this);
            fetch('/save', {
                method: 'POST',
                body: new URLSearchParams(formData)
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    showStatus('Configuration saved! Device will restart and connect to ' + formData.get('wifi_ssid'), 'success');
                    setTimeout(() => {
                        showStatus('Restarting device...', 'info');
                    }, 2000);
                } else {
                    showStatus('Save failed: ' + (data.error || 'Unknown error'), 'error');
                }
            })
            .catch(e => showStatus('Save failed: ' + e, 'error'));
        });

        // Load current config
        fetch('/config')
            .then(r => r.json())
            .then(data => {
                if (data.wifi_ssid) document.getElementById('wifi_ssid').value = data.wifi_ssid;
                if (data.supa_url) document.getElementById('supa_url').value = data.supa_url;
                if (data.main_warn) document.getElementById('main_warn').value = data.main_warn;
                if (data.main_alarm) document.getElementById('main_alarm').value = data.main_alarm;
                if (data.tap_warn) document.getElementById('tap_warn').value = data.tap_warn;
                if (data.tap_alarm) document.getElementById('tap_alarm').value = data.tap_alarm;
            });
    </script>
</body>
</html>
)rawliteral";

const char SAVED_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuration Saved</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .card {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
        }
        .icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        h1 {
            font-size: 24px;
            margin-bottom: 16px;
        }
        p {
            color: #888;
            line-height: 1.6;
        }
        .spinner {
            margin: 20px auto;
            width: 40px;
            height: 40px;
            border: 3px solid rgba(79, 195, 247, 0.2);
            border-top-color: #4fc3f7;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">✅</div>
        <h1>Configuration Saved!</h1>
        <p>The device is restarting and will connect to your WiFi network.</p>
        <div class="spinner"></div>
        <p style="font-size: 13px; margin-top: 20px;">
            You can close this page. Check the device display for connection status.
        </p>
    </div>
</body>
</html>
)rawliteral";

#endif // WEB_PAGES_H
