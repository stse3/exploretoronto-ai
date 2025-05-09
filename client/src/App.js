import logo from './logo.svg';
import './App.css';

function App() {
  const [message,setMessage] = useState('');
  const [recommendations, setRecommendations] = useState([]);

  const handleSubmit = async (e)=>{
    e.preventDefault();
    const res = await axios.post(`${process.env.BACKEND_URL}/recommend`);
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
        <button type="submit">Find Events!</button>
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
