'use client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
const icon=L.icon({iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',iconAnchor:[12,41]});
function Fit({points}:{points:[number,number][]}){const map=useMap();useEffect(()=>{if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[25,25]});},[map,points]);return null;}
export function LeafletMap({user, hospital, route}:{user:[number,number];hospital?:{lat:number;lon:number;name:string};route?:[number,number][]}){const all=route?.length?route:[user,...(hospital?[[hospital.lat,hospital.lon] as [number,number]]:[])];return <MapContainer center={user} zoom={13} scrollWheelZoom={false}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Marker position={user} icon={icon}><Popup>Your location</Popup></Marker>{hospital&&<Marker position={[hospital.lat,hospital.lon]} icon={icon}><Popup>{hospital.name}</Popup></Marker>}{route&&<Polyline positions={route}/>}<Fit points={all}/></MapContainer>}
