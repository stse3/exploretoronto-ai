// EventCard.jsx
import { motion } from 'framer-motion'; 
import { Calendar, MapPin } from 'lucide-react';   

export default function EventCard({ event, index }) {
  // Format date if available
  const formatDate = () => {
    try {
      // Check if event.date exists and is valid
      if (event.date) {
        const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        return `${formattedDate} at ${event.start_time || '12:00 AM'}`;
      }
      // Fallback if date is missing
      return `${event.start_time || 'Time TBD'}`;
    } catch (error) {
      // Safety fallback for any formatting errors
      return 'Date and time TBD';
    }
  };
  
  // Simplified animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.3,
        delay: index * 0.05  // Reduced delay between cards
      }
    }
  };

  // Subtle hover effect for buttons
  const buttonHoverEffect = {
    scale: 1.01,
    transition: { duration: 0.2 }
  };
  
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event.title || 'Event',
        text: event.description || 'Check out this event!',
        url: event.link || window.location.href,
      }).catch((error) => console.error('Error sharing', error));
    } else {
      alert('Sharing is not supported in this browser.');
    }
  };
  
  return (
    <motion.div
    variants={cardVariants}
    initial="hidden"
    animate="visible"
    className="bg-white rounded-[40px] overflow-hidden border border-black relative" style={{ boxShadow: '5px 5px 0px 0px rgba(0,0,0,0.8)' }}
  >
      {/* Image section */}
      {event.image && (
        <div className="w-full p-4 overflow-hidden">
          <img
            src={event.image}
            alt={event.title || 'Event'}
            className="w-full rounded-[32px] border border-black"
          />
        </div>
      )}
      
      <div className="px-4 pb-4 flex flex-col h-full text-black">
        <h3 className="text-xl font-bold mb-2">
          {event.title || 'Event Title'}
        </h3>
        
        <div className="flex items-center text-sm mb-1">
          <MapPin className="h-4 w-4 mr-1" />
          <span>{event.location || "Japanese Canadian Cultural Centre"}</span>
        </div>
        
        <div className="flex items-center text-sm mb-3">
          <Calendar className="h-4 w-4 mr-1" />
          <span>{formatDate()}</span>
        </div>
        
        <p className="text-xs mb-4">
          {event.description || 'The Japanese Canadian Cultural Centre (JCCC) is delighted to announce the launch of SakuraFest, an exciting new annual celebration that honours the cultural and seasonal'}
        </p>
        
        <div className="flex space-x-3 mt-2">
          <motion.a 
            href={event.link || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-full border border-black transition-all text-black text-center bg-white"
            whileHover={buttonHoverEffect}
          >
            Learn More
          </motion.a>
          
          <motion.button
            onClick={handleShare}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-full transition-all text-white text-center bg-black"
            whileHover={buttonHoverEffect}
          >
            Share
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}