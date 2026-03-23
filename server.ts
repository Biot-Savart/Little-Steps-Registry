import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route to fetch metadata from a URL
  app.get("/api/metadata", async (req, res) => {
    let url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Ensure URL has a protocol
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    try {
      // Special handling for Takealot URLs
      if (url.toLowerCase().includes('takealot.com')) {
        const idMatch = url.match(/(PLID\d+|TSIN\d+)/i);
        if (idMatch) {
          try {
            const productId = idMatch[1];
            const apiUrl = `https://api.takealot.com/rest/v-1-10-0/product-details/${productId}?platform=desktop`;
            const apiRes = await axios.get(apiUrl, { timeout: 8000 });
            if (apiRes.data && apiRes.data.core && apiRes.data.core.title) {
              const title = apiRes.data.core.title;
              let images: string[] = [];
              if (apiRes.data.gallery && apiRes.data.gallery.images) {
                images = apiRes.data.gallery.images.map((img: string) => img.replace('{size}', 'pdpxl'));
              }
              return res.json({ images: images.slice(0, 15), title: title.trim() });
            }
          } catch (e) {
            console.error("Takealot API error:", e);
            // Fall back to normal scraping if API fails
          }
        }
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 8000
      });

      const $ = cheerio.load(response.data);
      const images: string[] = [];
      
      // Helper to clean and resolve URLs
      const resolveUrl = (src: string) => {
        if (!src) return null;
        if (src.startsWith('data:')) return null; // Skip base64 for now
        if (src.startsWith('//')) return 'https:' + src;
        if (!src.startsWith('http')) {
          try {
            const urlObj = new URL(url);
            return urlObj.origin + (src.startsWith('/') ? '' : '/') + src;
          } catch (e) {
            return null;
          }
        }
        return src;
      };

      // 1. Open Graph image (usually the best one)
      const ogImage = resolveUrl($('meta[property="og:image"]').attr('content') || 
                                 $('meta[name="twitter:image"]').attr('content'));
      if (ogImage) images.push(ogImage);

      // Extract title
      let title = '';
      const h1Text = $('h1').first().text().trim();
      const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
      const pageTitle = $('title').text().trim();

      // JSON-LD extraction for Product Schema and hidden images
      let jsonLdTitle = '';
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const data = JSON.parse($(el).html() || '{}');
          const items = Array.isArray(data) ? data : [data];
          
          const extractImagesFromJson = (obj: any) => {
            if (!obj) return;
            if (typeof obj === 'string' && (obj.startsWith('http') || obj.startsWith('//')) && obj.match(/\.(jpeg|jpg|gif|png|webp)/i)) {
               const resolved = resolveUrl(obj);
               if (resolved && !images.includes(resolved)) images.push(resolved);
            } else if (Array.isArray(obj)) {
               obj.forEach(extractImagesFromJson);
            } else if (typeof obj === 'object') {
               if (obj.image) extractImagesFromJson(obj.image);
               Object.values(obj).forEach(extractImagesFromJson);
            }
          };

          for (const item of items) {
            extractImagesFromJson(item);
            if (item['@type'] === 'Product' && item.name) {
              jsonLdTitle = item.name;
            }
          }
        } catch (e) {}
      });

      if (jsonLdTitle) {
        title = jsonLdTitle;
      } else if (h1Text && h1Text.length > 5) {
        title = h1Text;
      } else if (ogTitle) {
        title = ogTitle;
      } else {
        title = pageTitle;
      }

      // Clean up common generic store names or suffixes
      const genericStoreNames = [
        "Takealot.com: Online Shopping | SA's leading online store",
        "Amazon.com",
        "Walmart.com"
      ];

      if (genericStoreNames.includes(title) || title === 'Takealot.com' || title.toLowerCase().includes('just a moment') || title.toLowerCase().includes('attention required')) {
        title = ''; // Force fallback
      } else if (title) {
        // Remove common suffixes
        title = title.split(' | ')[0].split(' - ')[0].trim();
      }

      // Fallback to URL slug if title is still empty or generic
      if (!title) {
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
          
          // Find the longest path segment that contains hyphens, it's usually the product slug
          let longestPart = '';
          for (const part of pathParts) {
            if (part.length > longestPart.length && part.includes('-')) {
              longestPart = part;
            }
          }
          
          if (!longestPart && pathParts.length > 0) {
            longestPart = pathParts[0];
          }

          if (longestPart) {
            title = longestPart
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          }
        } catch (e) {
          // Ignore URL parsing errors
        }
      }

      // 2. Collect all other images (checking data-src for lazy loading)
      $('img').each((i, el) => {
        const src = $(el).attr('src') || 
                    $(el).attr('data-src') || 
                    $(el).attr('data-original') || 
                    $(el).attr('data-lazy-src') || 
                    $(el).attr('data-zoom-image');
        const resolved = resolveUrl(src || '');
        if (resolved && !images.includes(resolved)) {
          // Basic filtering: skip tiny icons/trackers if possible
          // In a real scraper we'd check dimensions, but here we just collect
          images.push(resolved);
        }
      });

      // Limit to top 15 images to avoid overwhelming the UI
      res.json({ images: images.slice(0, 15), title: title.trim() });
    } catch (error) {
      console.error("Error fetching metadata:", error);
      res.status(500).json({ error: "Failed to fetch metadata" });
    }
  });

  // API Route for AI Recommendations
  app.post("/api/recommendations", async (req, res) => {
    const { dueDate, hemisphere, itemsList } = req.body;

    if (!dueDate || !hemisphere) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        You are an expert baby registry consultant.
        Here is a baby registry for a baby due on ${dueDate} in the ${hemisphere} hemisphere.
        
        Current items in the registry:
        ${itemsList || "No items yet."}
        
        Based on the current items, the due date (consider the season), and the hemisphere, what are 5 to 8 essential items that are missing from this registry?
        Provide practical, specific recommendations.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Name of the product" },
                category: { type: Type.STRING, description: "Category (e.g., Gear, Feeding, Clothing, Nursery, Toys, Health, Diapering)" },
                description: { type: Type.STRING, description: "Short description of the item" },
                estimatedPrice: { type: Type.NUMBER, description: "Estimated price in USD" },
                reason: { type: Type.STRING, description: "Why this is recommended based on the registry gaps, due date, or season" }
              },
              required: ["name", "category", "description", "estimatedPrice", "reason"]
            }
          }
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        res.json({ suggestions: parsed });
      } else {
        throw new Error("No response from AI.");
      }
    } catch (error: any) {
      console.error("AI Recommendation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate recommendations." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
