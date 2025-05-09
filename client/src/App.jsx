import React, {useState} from 'react';
import axios from 'axios'

function App() {
  const [message,setMessage] = useState('');
  const [recommendations, setRecommendations] = useState([]);

  const handleSubmit = async (e)=>{
    e.preventDefault();
    console.log("ITS ", import.meta.env.VITE_BACKEND_URL)
    const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/recommend`, {
      message: message
    });    
    setRecommendations(res.data.recommendations);
  }

  return (
    <div className="App">
      <h1>WanderTO AI - Keeping Toronto Connected</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={message}
          onChange={(e)=>setMessage(e.target.value)}
          placeholder="What are you feeling?"
          >
        
        </input>
        <button type="submit">find</button>
        <ul>
          {recommendations.map((rec,i)=>(
            <li key={i}>{rec.title} - {rec.location}</li>
          ))}

        </ul>

      </form>

    </div>
  );
}


export default App;

