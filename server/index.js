require('dotenv').config();
const express = require('express');
const recommender = require('./recommender'); // Make sure you still need this if you're using Supabase
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js'); // ❗ Typo fixed here
const app = express();

// ✅ Supabase client setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const PORT = process.env.PORT || 5000;

// ✅ CORS config
app.use(cors({
    origin: process.env.VITE_FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// ✅ POST /recommend route
app.post('/recommend', async (req, res) => {
    const userInput = req.body.message;

    if (!userInput) {
        return res.status(400).json({ error: 'No user input provided' });
    }

    // 🔍 Modify this to match your actual Supabase table and filtering logic
    const { data, error } = await supabase
        .from('events') // ✅ Make sure your table is called 'events'
        .select('*')
        .ilike('category', `%${userInput}%`) // ❗ ilike might need to match a real column like "category" or "title"
        .gte('date', new Date().toISOString()); // ✅ Optional: Only future events

    if (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }

    res.json({ recommendations: data });
});

// ✅ Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
