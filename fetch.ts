import axios from 'axios';
import fs from 'fs';

async function run() {
  try {
    const res = await axios.get('https://www.takealot.com/interactive-baby-activity-gym-play-mat/PLID99664953', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    fs.writeFileSync('takealot.html', res.data);
    console.log('Done');
  } catch (e) {
    console.error(e.message);
  }
}
run();
