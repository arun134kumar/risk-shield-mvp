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
