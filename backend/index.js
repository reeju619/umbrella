const express = require("express");
const axios = require("axios");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
require("dotenv").config();

const NewsArticle = require("./models/NewsArticle");

const app = express();
app.use(cors());
app.use(express.json());

const cities = [
  "Kuala Lumpur",
  "Cape Town",
  "Buenos Aires",
  "New Delhi",
  "Copenhagen",
  "Venice",
  "Casablanca",
  "Las Vegas",
  "Osaka",
  "Guangzhou",
  "Saint Petersburg",
  "Riyadh",
  "Berlin",
  "Nottingham",
  "Jakarta"
];

const API_KEY = process.env.OPENWEATHERMAP_API_KEY;

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("MongoDB connected..."))
  .catch((err) => console.error("MongoDB connection error:", err));

// Nodemailer transport setup
const transport = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS,
  },
});

// Endpoint to fetch weather for predefined cities
app.get("/weather", async (req, res) => {
  try {
    const weatherData = await Promise.all(
      cities.map(async (city) => {
        const response = await axios.get(
          `http://api.openweathermap.org/data/2.5/weather`,
          {
            params: {
              q: city,
              appid: API_KEY,
              units: "metric",
            },
          }
        );
        return response.data;
      })
    );
    res.json(weatherData);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Endpoint to subscribe and send weather alerts
app.post("/subscribe", async (req, res) => {
  const { email, location } = req.body;
  try {
    const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: location,
          appid: API_KEY,
          units: "metric",
        },
      }
    );
    const weatherData = response.data;
    const condition = weatherData.weather[0].main;
    const temperature = weatherData.main.temp;

    // Build alert message
    let alertMessage = "";
    if (
      condition.toLowerCase().includes("rain") ||
      condition.toLowerCase().includes("thunderstorm")
    ) {
      alertMessage = `Alert: There is a ${condition} expected in ${location}. Please take necessary precautions.`;
    }

    // Send data to Pipedream webhook
    await axios.post("https://eol25tdfuhr5r8n.m.pipedream.net", {
      recipient_email: email,
      location,
      condition,
      temperature,
      alertMessage,
    });

    res.status(200).json({
      message: "Subscription successful, weather alert sent via Pipedream!",
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
});

// Endpoint to fetch weather for a specific location
app.get("/weather/:location", async (req, res) => {
  const { location } = req.params;
  try {
    const response = await axios.get(
      `http://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: location,
          appid: API_KEY,
          units: "metric",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
});

// CRUD Operations for News Articles

// Fetch all articles
app.get("/articles", async (req, res) => {
  try {
    const articles = await NewsArticle.find();
    res.json(articles);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching articles", error: error.message });
  }
});

// Add a new article
app.post("/articles", async (req, res) => {
  const { title, description, imageUrl } = req.body;
  try {
    const newArticle = new NewsArticle({ title, description, imageUrl });
    await newArticle.save();
    res.status(201).json(newArticle);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding article", error: error.message });
  }
});

// Edit an article
app.put("/articles/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, imageUrl } = req.body;
  try {
    const updatedArticle = await NewsArticle.findByIdAndUpdate(
      id,
      { title, description, imageUrl },
      { new: true }
    );
    res.json(updatedArticle);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error editing article", error: error.message });
  }
});

// Delete an article
app.delete("/articles/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await NewsArticle.findByIdAndDelete(id);
    res.status(204).json({ message: "Article deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting article", error: error.message });
  }
});

// Fetch a single article by ID
app.get("/articles/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const article = await NewsArticle.findById(id);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    res.json(article);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching article", error: error.message });
  }
});

// Search articles by query
app.get("/search-articles", async (req, res) => {
  const { query } = req.query;
  try {
    const articles = await NewsArticle.find({
      title: { $regex: query, $options: "i" },
    });
    res.json(articles);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error searching articles", error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
