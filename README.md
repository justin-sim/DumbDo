# DumbDo

A stupidly simple todo list application that just works. No complex database, no unnecessary features - just todos.

![image](https://github.com/user-attachments/assets/a7857b13-db10-430f-af20-aedbf0d26023)


## Features

- ✨ Clean, minimal interface
- 🌓 Dark/Light mode with system preference detection
- 💾 File-based storage - todos persist between sessions
- 📱 Fully responsive design
- 🚀 Fast and lightweight
- 🔒 PIN protection (4-10 digits if enabled)

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| PORT | The port number the server will listen on | 3000 | No |
| DUMBDO_PIN | PIN protection for accessing todos (4-10 digits) | - | No |

## Quick Start

### Running Locally

1. Clone the repository
```bash
git clone https://github.com/dumbwareio/dumbdo.git
cd dumbdo
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Open http://localhost:3000 in your browser

### Using Docker

1. Pull from Docker Hub (recommended)
```bash
docker pull dumbwareio/dumbdo:latest
docker run -p 3000:3000 -v $(pwd)/data:/app/data dumbwareio/dumbdo:latest
```

2. Or build locally
```bash
docker build -t dumbwareio/dumbdo .
docker run -p 3000:3000 -v $(pwd)/data:/app/data dumbwareio/dumbdo
```

## Storage

Todos are stored in a JSON file at `app/data/todos.json`. The file is automatically created when you first run the application. 

To backup your todos, simply copy the `data` directory. To restore, place your backup `todos.json` in the `data` directory.

## Development

The application follows the "Dumb" design system principles:

- No complex storage
- Single purpose, done well
- "It just works"

### Project Structure

```
dumbdo/
├── app.js          # Frontend JavaScript
├── index.html      # Main HTML file
├── server.js       # Node.js server
├── styles.css      # CSS styles
├── data/          # Todo storage directory
│   └── todos.json
├── Dockerfile     # Docker configuration
└── package.json   # Dependencies and scripts
```

## Contributing

This is meant to be a simple application. If you're writing complex code to solve a simple problem, you're probably doing it wrong. Keep it dumb, keep it simple. 
