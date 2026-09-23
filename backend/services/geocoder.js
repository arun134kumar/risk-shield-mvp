const axios = require('axios');

// Simple in-memory cache to prevent duplicate geocoding requests 
// and to avoid hitting Nominatim rate limits.
const geocodeCache = new Map();

/**
 * Geocodes an address string using OpenStreetMap Nominatim.
 * Returns { lat, lng, displayName } or null if not found/failed.
 */
async function geocodeAddress(address) {
    if (!address || address.trim() === '') return null;
    
    const cleanAddress = address.trim().toUpperCase();
    
    // Check Cache
    if (geocodeCache.has(cleanAddress)) {
        return geocodeCache.get(cleanAddress);
    }

    // Offline lookup table for demo/fallback
    const OFFLINE_LOOKUP = {
        'GORAKHPUR': { lat: 26.7606, lng: 83.3732, displayName: 'Gorakhpur, Uttar Pradesh, India' },
        'LUCKNOW': { lat: 26.8467, lng: 80.9462, displayName: 'Lucknow, Uttar Pradesh, India' },
        'KANPUR': { lat: 26.4499, lng: 80.3319, displayName: 'Kanpur, Uttar Pradesh, India' },
        'NEW DELHI': { lat: 28.6139, lng: 77.2090, displayName: 'New Delhi, Delhi, India' },
        'MUMBAI': { lat: 19.0760, lng: 72.8777, displayName: 'Mumbai, Maharashtra, India' },
        'BENGALURU': { lat: 12.9716, lng: 77.5946, displayName: 'Bengaluru, Karnataka, India' },
        'KORAMANGALA': { lat: 12.9352, lng: 77.6245, displayName: 'Koramangala, Bengaluru, Karnataka, India' },
        'VARANASI': { lat: 25.3176, lng: 82.9739, displayName: 'Varanasi, Uttar Pradesh, India' }
    };

    // Fast check for known offline cities
    for (const [city, data] of Object.entries(OFFLINE_LOOKUP)) {
        if (cleanAddress.includes(city)) {
            geocodeCache.set(cleanAddress, data);
            return data;
        }
    }

    try {
        console.log(`[Geocoder] Requesting coordinates for: ${cleanAddress}`);
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: {
                q: cleanAddress + ', India', // Contextualizing for better hits
                format: 'json',
                limit: 1
            },
            headers: {
                // Nominatim requires a valid User-Agent
                'User-Agent': 'RiskShield-MVP-App/1.0'
            },
            timeout: 5000 // Don't hang the parser
        });
        
        if (response.data && response.data.length > 0) {
            const result = {
                lat: parseFloat(response.data[0].lat),
                lng: parseFloat(response.data[0].lon),
                displayName: response.data[0].display_name
            };
            geocodeCache.set(cleanAddress, result);
            return result;
        } else {
            console.log(`[Geocoder] No results found for: ${cleanAddress}`);
        }
    } catch (err) {
        console.error(`[Geocoder] Failed to geocode ${cleanAddress}:`, err.message);
    }
    
    // Cache the miss as well so we don't retry bad locations
    geocodeCache.set(cleanAddress, null);
    return null;
}

module.exports = { geocodeAddress };
