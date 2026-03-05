import React, { useState, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsRenderer, // ✅ NEW
} from "@react-google-maps/api";
import {
  MapPin,
  Clock,
  User,
  Car,
  CreditCard,
  AlertCircle,
  CheckCircle,
  Navigation,
  AlertTriangle,
  Info,
} from "lucide-react";
import socketService from "../utils/socket";

const GOOGLE_MAPS_API_KEY = "AIzaSyB4rilTPZoZBVoOgZHcOzwmbUp8PfwpgAE";
const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:9000/api";
const LIBRARIES = ["places"]; // ✅ stable reference - prevent re-renders

const mapContainerStyle = { height: "100%", width: "100%" };
const mapOptions = {
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: false,
  fullscreenControl: false,
};

function ShareableMap() {
  const mapRef = useRef(null);
  const [tripData, setTripData] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const markerRef = useRef(null);
  const animationRef = useRef(null);
  const [directionsResult, setDirectionsResult] = useState(null); // ✅ NEW

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const getTripIdFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tripId") || "6982e014bbda598007f477a5";
  };

  const parseDriverLocation = (driverLocation) => {
    if (!driverLocation) return null;
    if (
      driverLocation.type === "Point" &&
      Array.isArray(driverLocation.coordinates)
    ) {
      return {
        lng: driverLocation.coordinates[0],
        lat: driverLocation.coordinates[1],
      };
    }
    if (driverLocation.lat && driverLocation.lng) return driverLocation;
    return null;
  };

  // ✅ NEW: Fetch actual road route from Google Directions API
  const fetchDirections = (pickupCoords, dropCoords, waypoints = []) => {
    if (!window.google) return;

    const directionsService = new window.google.maps.DirectionsService();

    const waypointsList = waypoints.map((wp) => ({
      location: new window.google.maps.LatLng(wp.lat, wp.lng),
      stopover: true,
    }));

    directionsService.route(
      {
        origin: new window.google.maps.LatLng(
          pickupCoords.lat,
          pickupCoords.lng,
        ),
        destination: new window.google.maps.LatLng(
          dropCoords.lat,
          dropCoords.lng,
        ),
        waypoints: waypointsList,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          console.log("✅ Directions fetched successfully");
          setDirectionsResult(result);
        } else {
          console.error("❌ Directions fetch failed:", status);
        }
      },
    );
  };

  useEffect(() => {
    const fetchTripData = async () => {
      try {
        setLoading(true);
        const tripId = getTripIdFromURL();
        const response = await fetch(`${API_BASE_URL}/activeRide/${tripId}`);
        if (!response.ok) throw new Error("Failed to fetch trip data");

        const result = await response.json();

        if (result.success && result.data) {
          const apiData = result.data;
          const parsedDriverLocation = parseDriverLocation(
            apiData.driverLocation,
          );

          const transformedData = {
            _id: apiData._id,
            tripId: apiData.bookingId,
            status: apiData.status,
            pickup: {
              location: apiData.pickupLocation,
              coordinates: {
                lat: apiData.pickupCoordinates.lat,
                lng: apiData.pickupCoordinates.lng,
              },
              time: apiData.date,
            },
            stops: [],
            drop: {
              location: apiData.dropLocation,
              coordinates: {
                lat: apiData.dropCoordinates.lat,
                lng: apiData.dropCoordinates.lng,
              },
              time: apiData.tripEndTime,
            },
            tripStartTime: apiData.tripStartTime,
            tripEndTime: apiData.tripEndTime,
            driver: apiData.assignedDriver
              ? {
                  name: apiData.assignedDriver.name || "Not Assigned",
                  phone: apiData.assignedDriver.phone || "N/A",
                  email: apiData.assignedDriver.email || "N/A",
                  image: apiData.assignedDriver.image || "N/A",
                }
              : null,
            cab: {
              type: apiData.cabDetails?.vehicleType || "Unknown",
              model: apiData.cabDetails?.vehicleVariant || "Unknown",
              number: apiData.cabDetails?.vehicleNumber || "N/A",
              image: apiData.cabDetails?.cabImage,
            },
            payment: {
              advanceAmount: apiData.advanceAmount || 0,
              pendingAmount: apiData.pendingAmount || 0,
              totalAmount: apiData.totalAmount || 0,
              mode: apiData.paymentStatus,
            },
            currentLocation: parsedDriverLocation,
            rideType: apiData.rideType,
            bookingType: apiData.bookingType,
            pickups: apiData.pickups,
            isFareRecalculated: apiData.isFareRecalculated || false,
            isDropLocationChanged: apiData.isDropLocationChanged || false,
            fareRecalculationReason: apiData.fareRecalculationReason || null,
            extraCharges: apiData.extraCharges || 0,
            actualDropLocation: apiData.actualDropLocation || null,
          };

          setTripData(transformedData);
          if (parsedDriverLocation) setLiveLocation(parsedDriverLocation);
        } else {
          setError(result.message || "Trip not found");
        }
      } catch (err) {
        console.error("Error fetching trip data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTripData();
  }, []);

  // ✅ Fetch road directions once tripData + Google Maps is ready
  useEffect(() => {
    if (!tripData || !isLoaded) return;

    const dropCoords =
      tripData.isDropLocationChanged &&
      tripData.actualDropLocation?.coordinates?.lat
        ? {
            lat: tripData.actualDropLocation.coordinates.lat,
            lng: tripData.actualDropLocation.coordinates.lng,
          }
        : tripData.drop.coordinates;

    const stopWaypoints = tripData.stops?.map((s) => s.coordinates) || [];

    fetchDirections(tripData.pickup.coordinates, dropCoords, stopWaypoints);
  }, [tripData, isLoaded]);

  const moveMarkerSmoothly = (from, to) => {
    if (!markerRef.current) return;
    const steps = 30; // ✅ smoother animation
    let step = 0;
    const latStep = (to.lat - from.lat) / steps;
    const lngStep = (to.lng - from.lng) / steps;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const animate = () => {
      step++;
      const nextPos = {
        lat: from.lat + latStep * step,
        lng: from.lng + lngStep * step,
      };
      markerRef.current.setPosition(nextPos);
      if (step < steps) animationRef.current = requestAnimationFrame(animate);
    };
    animate();
  };

  // ✅ Socket: listen for live driver location
  useEffect(() => {
    if (!tripData?._id) return;

    socketService.initializeConnection({
      role: "public",
      rideId: tripData._id,
    });
    socketService.joinRideTrackingRoom(tripData._id);

    socketService.onRideLocationUpdate((data) => {
      console.log("📡 Socket Location:", data);
      if (data?.lat && data?.lng) {
        setLiveLocation((prev) => {
          if (prev) moveMarkerSmoothly(prev, { lat: data.lat, lng: data.lng });
          return { lat: data.lat, lng: data.lng };
        });
      }
    });

    return () => {
      socketService.leaveRideTrackingRoom(tripData._id);
      socketService.disconnect();
    };
  }, [tripData?._id]);

  useEffect(() => {
    if (liveLocation && mapRef.current) {
      mapRef.current.panTo(liveLocation);
    }
  }, [liveLocation]);

  const onLoad = (map) => {
    mapRef.current = map;
    if (tripData) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(tripData.pickup.coordinates);
      bounds.extend(tripData.drop.coordinates);
      if (tripData.currentLocation) bounds.extend(tripData.currentLocation);
      if (
        tripData.isDropLocationChanged &&
        tripData.actualDropLocation?.coordinates?.lat
      ) {
        bounds.extend({
          lat: tripData.actualDropLocation.coordinates.lat,
          lng: tripData.actualDropLocation.coordinates.lng,
        });
      }
      map.fitBounds(bounds);
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg font-medium">
            Loading trip details...
          </p>
        </div>
      </div>
    );
  }

  if (loadError || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Error Loading
          </h2>
          <p className="text-gray-600">
            {error || "Please check your internet connection."}
          </p>
        </div>
      </div>
    );
  }

  if (!tripData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Trip Not Found
          </h2>
          <p className="text-gray-600">
            The requested trip could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-xl">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Live Trip Tracking
                </h1>
                <p className="text-sm text-gray-500">
                  Trip ID: {tripData.tripId}
                </p>
              </div>
            </div>
            {(tripData.status === "In Progress" ||
              tripData.status === "Ride Started") && (
              <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-semibold text-sm">
                  {tripData.status}
                </span>
              </div>
            )}
            {(tripData.status === "Completed" ||
              tripData.status === "Dropped") && (
              <div className="bg-blue-100 px-4 py-2 rounded-full">
                <span className="text-blue-700 font-semibold text-sm">
                  {tripData.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Fare Recalculation Alert */}
        {tripData.isFareRecalculated && tripData.isDropLocationChanged && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-md">
            <div className="flex items-start p-4">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-1">
                  ⚠️ Fare Adjusted
                </h3>
                <p className="text-yellow-700 text-sm mb-2">
                  {tripData.fareRecalculationReason ||
                    "The fare has been recalculated due to route changes."}
                </p>
                {tripData.extraCharges > 0 && (
                  <div className="bg-yellow-100 rounded-md px-3 py-2 mt-2 inline-block">
                    <p className="text-yellow-900 font-semibold text-sm">
                      Additional Charges: ₹{tripData.extraCharges}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map Section */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="h-[400px] sm:h-[500px] lg:h-[600px] relative">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={liveLocation || tripData.pickup.coordinates}
              zoom={13}
              onLoad={onLoad}
              options={mapOptions}
            >
              {/* ✅ Road-following route (replaces straight Polyline) */}
              {directionsResult && (
                <DirectionsRenderer
                  directions={directionsResult}
                  options={{
                    suppressMarkers: true, // ✅ We use our own custom markers
                    polylineOptions: {
                      strokeColor: "#FF8C12",
                      strokeOpacity: 0.85,
                      strokeWeight: 5,
                    },
                  }}
                />
              )}

              {/* Pickup Marker - Green A */}
              <Marker
                position={tripData.pickup.coordinates}
                icon={{
                  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                  fillColor: "#10B981",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                  scale: 2,
                  anchor: new window.google.maps.Point(12, 22),
                }}
                label={{
                  text: "A",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              />

              {/* Original Drop Marker - Blue / faded if changed */}
              <Marker
                position={tripData.drop.coordinates}
                icon={{
                  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                  fillColor: "#1507E0",
                  fillOpacity: tripData.isDropLocationChanged ? 0.4 : 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                  scale: 2,
                  anchor: new window.google.maps.Point(12, 22),
                }}
                label={{
                  text: tripData.isDropLocationChanged ? "B₁" : "B",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              />

              {/* Actual Drop Marker - Red B₂ (if changed) */}
              {tripData.isDropLocationChanged &&
                tripData.actualDropLocation?.coordinates?.lat && (
                  <Marker
                    position={{
                      lat: tripData.actualDropLocation.coordinates.lat,
                      lng: tripData.actualDropLocation.coordinates.lng,
                    }}
                    icon={{
                      path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
                      fillColor: "#EF4444",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 2,
                      scale: 2,
                      anchor: new window.google.maps.Point(12, 22),
                    }}
                    label={{
                      text: "B₂",
                      color: "#ffffff",
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                  />
                )}

              {/* Live Cab Marker */}
              {liveLocation && (
                <Marker
                  position={liveLocation}
                  onLoad={(marker) => (markerRef.current = marker)}
                  icon={{
                    url: "https://cdn-icons-png.flaticon.com/512/3097/3097144.png", // Top-down yellow cab
                    scaledSize: new window.google.maps.Size(45, 45),
                    anchor: new window.google.maps.Point(22, 22),
                  }}
                />
              )}

              {tripData.status === "Completed" && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-full px-6 py-3 flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-semibold text-gray-800">
                    Trip Completed
                  </span>
                </div>
              )}
            </GoogleMap>
          </div>
        </div>

        {/* Trip Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Route Details */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <MapPin className="w-6 h-6 text-orange-500 mr-2" />
              Trip Route
            </h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 font-medium">
                    Pickup Location
                  </p>
                  <p className="text-gray-800 font-semibold">
                    {tripData.pickup.location}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" /> {tripData.pickup.time}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${tripData.isDropLocationChanged ? "bg-gray-100" : "bg-red-100"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${tripData.isDropLocationChanged ? "bg-gray-400" : "bg-red-500"}`}
                  ></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-yellow-500 font-medium">
                    {tripData.isDropLocationChanged
                      ? "Original Drop Location"
                      : "Drop Location"}
                  </p>
                  <p
                    className={`font-semibold ${tripData.isDropLocationChanged ? "text-gray-500 line-through" : "text-gray-800"}`}
                  >
                    {tripData.drop.location}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" /> {tripData.drop.time}
                  </p>
                </div>
              </div>

              {tripData.isDropLocationChanged &&
                tripData.actualDropLocation?.address && (
                  <div className="flex items-start space-x-4 bg-red-50 rounded-lg p-4 border-2 border-red-200">
                    <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="text-sm text-red-700 font-semibold">
                          Actual Drop Location
                        </p>
                        <Info className="w-4 h-4 text-red-500" />
                      </div>
                      <p className="text-gray-800 font-semibold">
                        {tripData.actualDropLocation.address}
                      </p>
                      <p className="text-xs text-red-600 mt-2">
                        ⚠️ Drop location was changed during the trip
                      </p>
                    </div>
                  </div>
                )}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Ride Type</p>
                  <p className="text-lg font-bold text-blue-700">
                    {tripData.rideType}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-1">Booking Type</p>
                  <p className="text-lg font-bold text-purple-700">
                    {tripData.bookingType}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Driver & Payment */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <User className="w-6 h-6 text-orange-500 mr-2" />
                Driver & Cab Details
              </h2>
              {tripData.driver && (
                <div className="flex items-center space-x-4 mb-6">
                  <img
                    src={tripData.driver.image}
                    alt={tripData.driver.name}
                    className="w-20 h-20 rounded-full border-4 border-orange-100"
                  />
                  <div>
                    <p className="text-sm text-gray-500">Driver</p>
                    <p className="text-lg font-bold text-gray-800">
                      {tripData.driver.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {tripData.driver.phone}
                    </p>
                  </div>
                </div>
              )}
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 space-y-3">
                {tripData.cab.image && (
                  <div className="mb-3">
                    <img
                      src={tripData.cab.image}
                      alt="Cab"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
                <div className="flex items-center text-gray-700">
                  <Car className="w-5 h-5 text-orange-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-600">Vehicle</p>
                    <p className="font-semibold">
                      {tripData.cab.model} ({tripData.cab.type})
                    </p>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center mt-3">
                  <p className="text-sm text-gray-600 mb-1">Vehicle Number</p>
                  <p className="text-2xl font-bold text-gray-800 tracking-wider">
                    {tripData.cab.number}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <CreditCard className="w-6 h-6 text-orange-500 mr-2" />
                Payment Details
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Payment Status</span>
                  <span
                    className={`font-semibold px-3 py-1 rounded-full text-sm ${
                      tripData.payment.mode === "Paid"
                        ? "bg-green-100 text-green-700"
                        : tripData.payment.mode === "Advance Paid"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {tripData.payment.mode}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-semibold text-gray-800">
                    ₹{tripData.payment.totalAmount}
                  </span>
                </div>
                {tripData.isFareRecalculated && tripData.extraCharges > 0 && (
                  <div className="flex justify-between items-center py-3 border-b border-red-200 bg-red-50 -mx-4 px-4 rounded">
                    <span className="text-red-700 font-medium">
                      Extra Charges
                    </span>
                    <span className="font-bold text-red-600">
                      +₹{tripData.extraCharges}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Advance Paid</span>
                  <span className="font-bold text-green-600">
                    ₹{tripData.payment.advanceAmount}
                  </span>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-700">
                      Remaining
                    </span>
                    <span className="font-bold text-orange-600 text-xl">
                      ₹{tripData.payment.pendingAmount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ShareableMap;
