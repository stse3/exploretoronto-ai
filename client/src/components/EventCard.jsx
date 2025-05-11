import { motion } from 'framer-motion';

export default function EventCard({ event, index }) {
  // Format date if available
  const formatDate = (dateString) => {
    if (!dateString) return "Date TBA";
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-2">{event.title}</h3>
        
        <div className="flex items-center text-white/80 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{event.location || "Location TBA"}</span>
        </div>
        
        {event.date && (
          <div className="flex items-center text-white/80 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formatDate(event.date)}</span>
          </div>
        )}
        
        {event.description && (
          <p className="text-white/90 mb-4 line-clamp-3">
            {event.description}
          </p>
        )}
        
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="w-full bg-white/20 hover:bg-white/30 text-white py-2 rounded-lg transition-colors"
        >
          Learn More
        </motion.button>
      </div>
    </motion.div>
  );
}