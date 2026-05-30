/* ================= Map State ================= */
let selectedLocation = null;
let map;
let marker;
let geocoder;

/* ================= Map Initialization ================= */
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

    if (marker) marker.setMap(null);

    marker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
    });

    document.getElementById("latitude").value = lat;
    document.getElementById("longitude").value = lng;

    
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results[0]) {
        const components = results[0].address_components;

        let street = "";
        let neighborhood = "";
        let city = "";

        components.forEach((comp) => {
          if (comp.types.includes("route")) {
            street = comp.long_name;
          }
          if (
            comp.types.includes("sublocality") ||
            comp.types.includes("neighborhood")
          ) {
            neighborhood = comp.long_name;
          }
          if (comp.types.includes("locality")) {
            city = comp.long_name;
          }
        });

        if (!city) {
          const admin = components.find((c) =>
            c.types.includes("administrative_area_level_1")
          );
          city = admin?.long_name || "";
        }

        selectedLocation = {
          lat,
          lng,
          street,
          neighborhood,
          city,
        };

        const clean = [street, neighborhood, city]
          .filter(Boolean)
          .join("، ");

        document.getElementById("streetName").value = clean;
      }
    });

    console.log("📍 Selected:", selectedLocation);
  });
}


window.initMap = initMap;

/* ================= Google Maps Loader ================= */
function loadGoogleMaps() {
  if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
    const script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyB-uPN8afr4qXu5JE1Iew0wR5WfK3YscwY&callback=initMap";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }
}


loadGoogleMaps();

/* ================= Public Accessor ================= */
export function getSelectedLocation() {
  return selectedLocation;
}
