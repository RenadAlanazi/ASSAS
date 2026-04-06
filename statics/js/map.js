// map.js

let selectedLocation = null;
let map;
let marker;
let geocoder;

// ✅ Initialize the map
function initMap() {
  const defaultCenter = { lat: 24.7136, lng: 46.6753 }; // Riyadh

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 11,
    center: defaultCenter,
  });

  geocoder = new google.maps.Geocoder();

  map.addListener("click", (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    selectedLocation = { lat, lng };

    // Fill inputs automatically
    document.getElementById("latitude").value = lat;
    document.getElementById("longitude").value = lng;

    // Move marker
    if (marker) marker.setMap(null);

    marker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
    });

    // Get street name automatically
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        document.getElementById("streetName").value =
          results[0].formatted_address;
      }
    });

    console.log("📍 Selected:", selectedLocation);
  });
}

// ✅ Expose initMap globally for Google Maps callback
window.initMap = initMap;

// ✅ Export location getter for your modules
export function getSelectedLocation() {
  return selectedLocation;
}