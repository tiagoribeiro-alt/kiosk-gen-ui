from dataclasses import dataclass
from typing import Optional

import httpx


GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


@dataclass(frozen=True)
class WeatherForecastDay:
    date: str
    label: str
    weather_code: int
    weather_label: str
    temperature_max_c: float
    temperature_min_c: float
    precipitation_probability_max: int


@dataclass(frozen=True)
class WeatherSnapshot:
    location: str
    timezone: str
    current_temperature_c: float
    apparent_temperature_c: float
    weather_code: int
    weather_label: str
    wind_speed_kmh: float
    forecast_days: list[WeatherForecastDay]


async def fetch_weather_snapshot(location: str, days: int = 3) -> Optional[WeatherSnapshot]:
    resolved_days = max(1, min(days, 5))

    async with httpx.AsyncClient(timeout=10.0) as client:
        geocoding_response = await client.get(
            GEOCODING_URL,
            params={
                "name": location,
                "count": 1,
                "language": "pt",
                "format": "json",
                "countryCode": "PT",
            },
        )
        geocoding_response.raise_for_status()
        geocoding_data = geocoding_response.json()
        results = geocoding_data.get("results") or []
        if not results:
            return None

        match = results[0]

        weather_response = await client.get(
            FORECAST_URL,
            params={
                "latitude": match["latitude"],
                "longitude": match["longitude"],
                "current": "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                "forecast_days": resolved_days,
                "timezone": "auto",
            },
        )
        weather_response.raise_for_status()
        weather_data = weather_response.json()

    current = weather_data.get("current") or {}
    daily = weather_data.get("daily") or {}

    return WeatherSnapshot(
        location=match.get("name") or location,
        timezone=weather_data.get("timezone") or match.get("timezone") or "auto",
        current_temperature_c=float(current.get("temperature_2m", 0.0)),
        apparent_temperature_c=float(current.get("apparent_temperature", current.get("temperature_2m", 0.0))),
        weather_code=int(current.get("weather_code", 0)),
        weather_label=get_weather_label(int(current.get("weather_code", 0))),
        wind_speed_kmh=float(current.get("wind_speed_10m", 0.0)),
        forecast_days=_build_forecast_days(daily),
    )


def get_weather_label(code: int) -> str:
    if code == 0:
        return "Ceu limpo"
    if code in {1, 2, 3}:
        return "Pouco nublado"
    if code in {45, 48}:
        return "Nevoeiro"
    if code in {51, 53, 55, 56, 57}:
        return "Chuvisco"
    if code in {61, 63, 65, 66, 67}:
        return "Chuva"
    if code in {71, 73, 75, 77, 85, 86}:
        return "Neve"
    if code in {80, 81, 82}:
        return "Aguaceiros"
    if code in {95, 96, 99}:
        return "Trovoada"
    return "Tempo variavel"


def _build_forecast_days(daily: dict) -> list[WeatherForecastDay]:
    dates = daily.get("time") or []
    codes = daily.get("weather_code") or []
    maximums = daily.get("temperature_2m_max") or []
    minimums = daily.get("temperature_2m_min") or []
    precipitation_probs = daily.get("precipitation_probability_max") or []

    forecast_days: list[WeatherForecastDay] = []
    for index, date in enumerate(dates):
        code = int(codes[index]) if index < len(codes) else 0
        forecast_days.append(
            WeatherForecastDay(
                date=date,
                label=_get_day_label(index),
                weather_code=code,
                weather_label=get_weather_label(code),
                temperature_max_c=float(maximums[index]) if index < len(maximums) else 0.0,
                temperature_min_c=float(minimums[index]) if index < len(minimums) else 0.0,
                precipitation_probability_max=int(precipitation_probs[index]) if index < len(precipitation_probs) else 0,
            )
        )

    return forecast_days


def _get_day_label(index: int) -> str:
    if index == 0:
        return "Hoje"
    if index == 1:
        return "Amanha"
    return f"Dia {index + 1}"