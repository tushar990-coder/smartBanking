# Run Command Workflow Rule

Whenever the user says **"run"** or requests to start/run the project:

1. **Launch Backend (.NET Web API)**:
   - Command: `dotnet run`
   - Working Directory: `d:\Development\Webapps\SmartBanking\smartBanking\api\Bhisi.Api`
   - Daemon: `true` (runs in background)
   - Port: `http://localhost:5242`

2. **Launch Frontend (Vite + React)**:
   - Command: `npm run dev`
   - Working Directory: `d:\Development\Webapps\SmartBanking\smartBanking\client`
   - Daemon: `true` (runs in background)
   - Port: `http://localhost:5173`

3. **Report Status to User**:
   - Provide clickable links and exact URLs where the application is accessible:
     - **Frontend URL**: [http://localhost:5173](http://localhost:5173)
     - **Backend API URL**: [http://localhost:5242](http://localhost:5242)
     - **Swagger / API Health**: [http://localhost:5242/swagger](http://localhost:5242/swagger)
