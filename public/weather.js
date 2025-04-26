console.log("Weather script loaded");
async function setNewWeather() {
  const response = await fetch("/weather", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  const weather = document.getElementById("weather-desc");
  const weatherIcon = document.getElementById("weather-icon");
  weather.innerHTML = "Brovary " + data.current.temp_c + "°C";
  weatherIcon.src = data.current.condition.icon;
}
setNewWeather();
setInterval(setNewWeather, 3 * 60 * 1000);
