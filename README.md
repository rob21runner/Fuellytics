<a id="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/github_username/repo_name">
    <img src="static/img/fuellytics%20logo.png" alt="Logo" width="80" height="80">
  </a>
  <h1 align="center">Fuellytics</h1>
  
  [![Python](https://img.shields.io/badge/Python-3.12+-blue?logo=python&logoColor=white)](https://www.python.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-Backend-green?logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Leaflet](https://img.shields.io/badge/Leaflet-Map-brightgreen?logo=leaflet)](https://leafletjs.com/)
  [![SQLite](https://img.shields.io/badge/SQLite-Storage-lightgrey?logo=sqlite)](https://www.sqlite.org/index.html)
  [![MIT License](https://img.shields.io/github/license/rob21runner/Fuellytics)](LICENSE)
  [![Contributors](https://img.shields.io/github/contributors/rob21runner/Fuellytics.svg)](https://github.com/rob21runner/Fuellytics/graphs/contributors)
  [![Forks](https://img.shields.io/github/forks/rob21runner/Fuellytics.svg)](https://github.com/rob21runner/Fuellytics/network/members)
  [![Stargazers](https://img.shields.io/github/stars/rob21runner/Fuellytics.svg)](https://github.com/rob21runner/Fuellytics/stargazers)
  [![Issues](https://img.shields.io/github/issues/rob21runner/Fuellytics.svg)](https://github.com/rob21runner/Fuellytics/issues)
  <p align="center">
    Real-time fuel price dashboard with map, interactive stats, and admin monitoring panel. Built with FastAPI, Leaflet, Plotly & SQLite.
    <br />
    <a href="https://github.com/rob21runner/Fuellytics"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://fuellytics.robcorp.net">View Demo</a>
    &middot;
    <a href="https://github.com/rob21runner/Fuellytics/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/rob21runner/Fuellytics/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

## 📚 Table of Contents

- [🚀 Features](#features)
  - [🗺️ Interactive Map](#interactive-map)
  - [🧠 Admin Panel](#admin-panel)
  - [🔐 Security](#security)
- [📦 Tech Stack](#tech-stack)
- [⚙️ Installation](#installation-with-anaconda)
- [🌍 Data](#data)
- [🧪 Pages](#pages)
- [👥 Contributors](#contributors)
- [📄 License](#license)
- [💡 Ideas & Roadmap](#ideas--roadmap)


---

## 🚀 Features

### 🗺️ Interactive Map

- Real-time fuel prices in France
- Filter by fuel type: SP95, SP98, E10, E85, Gazole, GPLc
- Gradient color markers based on price (green → red)
- Station detail panel (address, services, current prices)
- 7-day price evolution with Plotly
- Geolocation support

### 🧠 Admin Panel

- HTTP Basic Auth (multi-user from `.env`)
- Fully interactive dashboard (Plotly, tables, maps)
- Timeline navigation (7d, 30d, 1y)

### 🔐 Security

- Admin login attempts are logged to Discord via webhook
- Shows IP, city/country, and static map preview
- Temporary ban after N failed attempts

---

## 📦 Tech Stack

| Frontend    | Backend | Data     | Visuals     |
| ----------- | ------- | -------- | ----------- |
| HTML/CSS/JS | FastAPI | SQLite   | Plotly.js   |
| Leaflet.js  | Uvicorn | CronJobs | FontAwesome |

---

## ⚙️ Installation

### 1. Clone the repository

Using SSH :
```bash
git clone git@github.com:rob21runner/Fuellytics.git

cd Fuellytics
```

Using HTTPS
```bash

git clone https://github.com/rob21runner/Fuellytics.git

cd Fuellytics
```

### 2. Create a virtual environment

Using venv :

```bash
python -m venv env
source env/bin/activate  # or .\env\Scripts\activate on Windows
pip install -r requirements.txt
```

Using Anaconda :

```bash
conda create -n fuellytics python=3.12
conda activate fuellytics
pip install -r requirements.txt
```

### 3. Create a `.env` file

Create a `.env` file in the root of the project and replace the placeholders with your own:

```env
ADMIN_USERS=admin1,admin2
ADMIN_PASSWORDS=password1,password2
INFO_WEBHOOK_URL=https://discord.com/api/webhooks/...
ERRORS_WEBHOOK_URL=https://discord.com/api/webhooks/...
ADMIN_WEBHOOK_URL=https://discord.com/api/webhooks/...
MAP_API_KEY=Your map api key
```

Get your map api key on [Geoapify](https://geoapify.com) to get the map geolocating users trying to loggin on your admin page.

### 4. Run the app

```bash
uvicorn main:app --reload
```

Or using :

```bash
python main.py
```

---

## 🌍 Data

- Source: [prix des carburants en France](https://data.economie.gouv.fr)
- Updates: 6 times per day at 15 past (00h, 04h, 08h, 12h, 16h, 20h)
- Stored for 7 days to enable historical trends

---

## 🧪 Pages

| Route       | Description                        |
| ----------- | ---------------------------------- |
| `/`         | Fuel price map                     |
| `/admin`    | Admin dashboard (secure)           |
| `/about`    | Project description & data sources |
| `/overview` | Global price visualization (soon)  |

---

## 👥 Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Top contributors:

<a href="https://github.com/rob21runner/Fuellytics/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=rob21runner/Fuellytics" />
</a>

---

## 📄 License

Distributed under the GPL-3.0 license. See [LICENSE](LICENSE) for more information.

---

## 💡 Ideas & Roadmap

- [ ] Overview page
- [ ] Admin page plots
- [ ] Dark mode toggle 🌙
- [ ] Filter by station services
- [ ] National overview per region
- [ ] Mobile PWA support
- [ ] Email reports for admins

---

*Made with ❤️ and geodata.*
