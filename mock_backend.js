const http = require('http');
const url = require('url');

const PORT = 8000;

// In-memory store for testing
const users = {
    'AHP-123456-XYZ': {
        ahp_id: 'AHP-123456-XYZ',
        password: 'Test@123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
    }
};

const otpStore = {};

function parseBody(req, callback) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            callback(JSON.parse(body));
        } catch {
            callback(null);
        }
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    console.log(`[Mock] ${req.method} ${req.url}`);

    // HEALTH CHECK
    if (pathname === '/health' || pathname === '/healthz' || pathname === '/readyz' || pathname === '/api/v1/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ready', mock: true, timestamp: new Date().toISOString() }));
    }

    // PATIENT LOGIN (AHP-ID based)
    else if (pathname === '/api/v1/patient/login-ahp' && req.method === 'POST') {
        parseBody(req, (body) => {
            const { ahp_id, password } = body;
            console.log(`[Login] Attempting login with AHP-ID: ${ahp_id}`);
            
            const user = users[ahp_id];
            if (user && user.password === password) {
                res.writeHead(200);
                res.end(JSON.stringify({
                    access_token: 'mock_token_' + Date.now(),
                    refresh_token: 'mock_refresh_' + Date.now(),
                    token_type: 'bearer',
                    ahp_id: ahp_id
                }));
            } else {
                res.writeHead(401);
                res.end(JSON.stringify({ detail: 'Invalid Mulajna ID or password' }));
            }
        });
    }

    // AUTH REGISTER
    else if (pathname === '/api/v1/auth/register' && req.method === 'POST') {
        parseBody(req, (body) => {
            const { email, password, first_name, last_name, role } = body;
            console.log(`[Register] New user: ${email} (${role})`);
            
            // Generate AHP-ID for patients
            let ahp_id = null;
            if (role === 'patient') {
                const num = Math.floor(Math.random() * 999999);
                ahp_id = `AHP-${String(num).padStart(6, '0')}-` + Math.random().toString(36).substring(2, 5).toUpperCase();
                users[ahp_id] = {
                    ahp_id,
                    password,
                    email,
                    first_name,
                    last_name
                };
            }
            
            res.writeHead(200);
            res.end(JSON.stringify({
                id: Math.floor(Math.random() * 10000),
                email,
                first_name,
                last_name,
                role
            }));
        });
    }

    // CHECK USER EXISTS
    else if (pathname === '/api/v1/auth/check-user' && req.method === 'GET') {
        const identifier = query.identifier;
        // For testing, user doesn't exist unless explicitly added
        res.writeHead(200);
        res.end(JSON.stringify({ exists: false }));
    }

    // SEND OTP
    else if (pathname === '/api/v1/auth/send-otp' && req.method === 'POST') {
        parseBody(req, (body) => {
            const { identifier, method } = body;
            const otp = '000000'; // Demo OTP
            otpStore[identifier] = otp;
            console.log(`[OTP] Sent OTP to ${identifier}: ${otp}`);
            
            res.writeHead(200);
            res.end(JSON.stringify({ 
                status: 'success', 
                message: `OTP sent via ${method}. Use: ${otp}`
            }));
        });
    }

    // VERIFY OTP
    else if (pathname === '/api/v1/auth/verify-otp' && req.method === 'POST') {
        const { email, otp } = query;
        console.log(`[OTP] Verifying OTP for ${email}`);
        
        if (otpStore[email] === otp) {
            res.writeHead(200);
            res.end(JSON.stringify({
                access_token: 'mock_token_' + Date.now(),
                refresh_token: 'mock_refresh_' + Date.now(),
                token_type: 'bearer'
            }));
        } else {
            res.writeHead(401);
            res.end(JSON.stringify({ detail: 'Invalid or expired OTP. Use 000000' }));
        }
    }

    // PROFILE SETUP
    else if (pathname === '/api/v1/profile/setup' && req.method === 'POST') {
        parseBody(req, (body) => {
            const { phone_number, first_name, last_name } = body;
            console.log(`[Profile] Setup for: ${phone_number}`);
            
            const ahp_id = `AHP-${Math.floor(Math.random() * 999999)}-${ Math.random().toString(36).substring(2, 5).toUpperCase()}`;
            
            res.writeHead(200);
            res.end(JSON.stringify({
                ahp_id,
                phone_number,
                first_name,
                last_name,
                is_active: true
            }));
        });
    }

    // CATCH-ALL
    else {
        res.writeHead(200);
        res.end(JSON.stringify({ 
            message: 'Mock endpoint', 
            path: pathname,
            available_endpoints: [
                '/api/v1/health',
                'POST /api/v1/patient/login-ahp',
                'POST /api/v1/auth/register',
                'GET /api/v1/auth/check-user',
                'POST /api/v1/auth/send-otp (OTP: 000000)',
                'POST /api/v1/auth/verify-otp',
                'POST /api/v1/profile/setup'
            ]
        }));
    }
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           Mock Backend API running on port ${PORT}              ║
╠════════════════════════════════════════════════════════════════╣
║  TEST DATA:                                                    ║
║  • AHP-ID: AHP-123456-XYZ                                      ║
║  • Password: Test@123                                          ║
║  • New OTP: 000000                                             ║
╠════════════════════════════════════════════════════════════════╣
║  Available Endpoints:                                          ║
║  • GET  /health                                                ║
║  • POST /api/v1/patient/login-ahp {ahp_id, password}           ║
║  • POST /api/v1/auth/register {email, password, role}          ║
║  • GET  /api/v1/auth/check-user?identifier=...                ║
║  • POST /api/v1/auth/send-otp {identifier, method}             ║
║  • POST /api/v1/auth/verify-otp?email=...&otp=...             ║
║  • POST /api/v1/profile/setup {phone_number, first_name...}    ║
╚════════════════════════════════════════════════════════════════╝
    `);
});
