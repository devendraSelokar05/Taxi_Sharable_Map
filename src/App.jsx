import React, { useState, useEffect, useRef } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
} from "@react-google-maps/api";
import {
  MapPin,
  Clock,
  User,
  Car,
  CreditCard,
  Phone,
  Mail,
  AlertCircle,
  CheckCircle,
  Navigation,
} from "lucide-react";
import socketService from "../utils/socket"; // path check kar lena

const GOOGLE_MAPS_API_KEY = "AIzaSyB4rilTPZoZBVoOgZHcOzwmbUp8PfwpgAE";
const POLLING_INTERVAL = 30000; // 30 second
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:9000/api";

const mapContainerStyle = {
  height: "100%",
  width: "100%",
};

const mapOptions = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  disableDefaultUI: false,
};

function ShareableMap() {
  const mapRef = useRef(null);
  const [tripData, setTripData] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const markerRef = useRef(null);
  const animationRef = useRef(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const getTripIdFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tripId") || "6982e014bbda598007f477a5";
  };

  // ✅ Helper: Convert GeoJSON to {lat, lng} format
  const parseDriverLocation = (driverLocation) => {
    if (!driverLocation) return null;

    // GeoJSON format: { type: "Point", coordinates: [lng, lat] }
    if (
      driverLocation.type === "Point" &&
      Array.isArray(driverLocation.coordinates)
    ) {
      return {
        lng: driverLocation.coordinates[0],
        lat: driverLocation.coordinates[1],
      };
    }

    // Already in {lat, lng} format
    if (driverLocation.lat && driverLocation.lng) {
      return driverLocation;
    }

    return null;
  };

  useEffect(() => {
    const fetchTripData = async () => {
      try {
        setLoading(true);
        const tripId = getTripIdFromURL();

        const response = await fetch(`${API_BASE_URL}/activeRide/${tripId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch trip data");
        }

        const result = await response.json();

        if (result.success && result.data) {
          const apiData = result.data;

          // ✅ Parse driver location (GeoJSON format)
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

            stops: [], // Add logic if needed

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
              color: "White",
              image: apiData.cabDetails?.cabImage,
            },

            payment: {
              advanceAmount: apiData.advanceAmount || 0,
              pendingAmount: apiData.pendingAmount || 0,
              totalAmount: apiData.totalAmount || 0,
              mode: apiData.paymentStatus,
            },

            // ✅ Use parsed driver location or fallback to pickup
            // currentLocation: parsedDriverLocation || {
            //   lat: apiData.pickupCoordinates.lat,
            //   lng: apiData.pickupCoordinates.lng,
            // },

            currentLocation: parsedDriverLocation,
            rideType: apiData.rideType,
            bookingType: apiData.bookingType,
            pickups: apiData.pickups,
          };

          console.log("✅ Transformed Data:", transformedData);
          console.log("📍 Live Location:", transformedData.currentLocation);

          setTripData(transformedData);
          if (parsedDriverLocation) {
            setLiveLocation(parsedDriverLocation);
          }
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

   const moveMarkerSmoothly = (from, to) => {
    if (!markerRef.current) return;

    const steps = 15;
    let step = 0;

    const latStep = (to.lat - from.lat) / steps;
    const lngStep = (to.lng - from.lng) / steps;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = () => {
      step++;

      const nextPos = {
        lat: from.lat + latStep * step,
        lng: from.lng + lngStep * step,
      };

      markerRef.current.setPosition(nextPos);

      if (step < steps) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  };
  // ✅ Poll for live location updates

  // ✅ Poll for live location - Check multiple active statuses
  //   useEffect(() => {
  //     const activeStatuses = [
  //       "In Progress",
  //       "Ride Started",
  //       "Completed",
  //       "Dropped",
  //     ];

  //     if (!tripData || !activeStatuses.includes(tripData.status)) return;

  //    const interval = setInterval(async () => {
  //     try {
  //       const tripId = getTripIdFromURL();
  //       const response = await fetch(
  //         `${API_BASE_URL}/activeRide/${tripId}`
  //       );

  //       if (!response.ok) return;

  //       const result = await response.json();

  //       const parsedLocation = parseDriverLocation(
  //         result.data?.currentLocation
  //       );

  //       if (parsedLocation) {
  //         setLiveLocation(parsedLocation);
  //       }
  //     } catch (err) {
  //       console.error("Error fetching live location:", err);
  //     }
  //   }, POLLING_INTERVAL);

  //   return () => clearInterval(interval);
  // }, [tripData]);

  useEffect(() => {
    if (!tripData?._id) return;

    // 1️⃣ socket connect
    socketService.initializeConnection({
      role: "public",
      rideId: tripData._id,
    });

    // 2️⃣ join ride room
    socketService.joinRideTrackingRoom(tripData._id);

    // 3️⃣ listen live driver location
    socketService.onRideLocationUpdate((data) => {
      console.log("📡 Socket Location:", data);

       if (data?.lat && data?.lng) {
        setLiveLocation((prev) => {
          if (prev) {
            moveMarkerSmoothly(prev, {
              lat: data.lat,
              lng: data.lng,
            });
          }
          return { lat: data.lat, lng: data.lng };
        });
      }
    });
    // 4️⃣ cleanup
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

      // ✅ ADD THIS (LIVE DRIVER LOCATION)
      if (tripData.currentLocation) {
        bounds.extend(tripData.currentLocation);
      }

      if (tripData.stops && tripData.stops.length > 0) {
        tripData.stops.forEach((stop) => bounds.extend(stop.coordinates));
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
            {error || "Please check your internet connection and try again."}
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

  const routeCoordinates = [
    tripData.pickup.coordinates,
    ...(tripData.stops?.map((stop) => stop.coordinates) || []),
    tripData.drop.coordinates,
  ].filter((coord) => coord && coord.lat && coord.lng);

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
            {/* {tripData.status === 'ongoing' && (
              <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-semibold text-sm">Live</span>
              </div>
            )}
            {tripData.status === 'completed' && (
              <div className="bg-blue-100 px-4 py-2 rounded-full">
                <span className="text-blue-700 font-semibold text-sm">Completed</span>
              </div>
            )} */}
            {/* // Header section - Update conditions */}
            {(tripData.status === "In Progress" ||
              tripData.status === "Ride Started") && (
              <div className="flex items-center space-x-2 bg-green-100 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 font-semibold text-sm">
                  {tripData.status}
                </span>
              </div>
            )}
            {tripData.status === "Completed" && (
              <div className="bg-blue-100 px-4 py-2 rounded-full">
                <span className="text-blue-700 font-semibold text-sm">
                  {tripData.status}
                </span>
              </div>
            )}
            {tripData.status === "Dropped" && (
              <div className="bg-blue-100 px-4 py-2 rounded-full">
                <span className="text-blue-700 font-semibold text-sm">
                  {tripData.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
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
              {/* Pickup Marker */}
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

              {/* Drop Marker */}
              <Marker
                position={tripData.drop.coordinates}
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
                  text: "B",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              />

              {/* Live Cab Location */}
              {liveLocation && (
                <Marker
                  position={liveLocation}
                  onLoad={(marker) => (markerRef.current = marker)}
                  icon={{
                    url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS95O2zAz1WQUPvjMoLIKKLY6R_Zl8iYzoeSw&s",
                    scaledSize: new window.google.maps.Size(48, 48),
                    anchor: new window.google.maps.Point(24, 24),
                  }}
                  // animation={window.google.maps.Animation.DROP}
                />
              )}

              {/* Route Polyline */}
              {routeCoordinates.length >= 2 && (
                <Polyline
                  path={routeCoordinates}
                  options={{
                    strokeColor: "#FF8C12",
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                  }}
                />
              )}
            </GoogleMap>

            {/* Status Badge Overlay */}
            {tripData.status === "completed" && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-full px-6 py-3 flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-semibold text-gray-800">
                  Trip Completed
                </span>
              </div>
            )}
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
              {/* Pickup */}
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
                    <Clock className="w-4 h-4 mr-1" />
                    {tripData.pickup.time}
                  </p>
                </div>
              </div>

              {/* Drop */}
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 font-medium">
                    Drop Location
                  </p>
                  <p className="text-gray-800 font-semibold">
                    {tripData.drop.location}
                  </p>
                  <p className="text-sm text-gray-600 mt-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {tripData.drop.time}
                  </p>
                </div>
              </div>
            </div>

            {/* Trip Info Cards */}
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

          {/* Driver & Cab Details + Payment */}
          <div className="space-y-6">
            {/* Driver & Cab Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <User className="w-6 h-6 text-orange-500 mr-2" />
                Driver & Cab Details
              </h2>

              {/* Driver Info */}
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

              {/* Cab Details */}
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

            {/* Payment Card */}
            {/* <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <CreditCard className="w-6 h-6 text-orange-500 mr-2" />
                Payment Details
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Payment Status</span>
                  <span className="font-semibold text-gray-800">
                    {tripData.payment.mode}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-semibold text-gray-800">
                    ₹{tripData.payment.totalAmount}
                  </span>
                </div>
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
            </div> */}

            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <CreditCard className="w-6 h-6 text-orange-500 mr-2" />
                Payment Details
              </h2>

              <div className="space-y-4">
                {/* Payment Status with Color Badge */}
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

                {/* Total Amount */}
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-semibold text-gray-800">
                    ₹{tripData.payment.totalAmount}
                  </span>
                </div>

                {/* Advance Paid */}
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <span className="text-gray-600">Advance Paid</span>
                  <span className="font-bold text-green-600">
                    ₹{tripData.payment.advanceAmount}
                  </span>
                </div>

                {/* Remaining Amount */}
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
