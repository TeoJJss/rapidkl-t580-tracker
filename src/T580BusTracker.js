import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import pako from 'pako';
import { getDistance } from 'geolib';
import './BusTracker.css';

const routeNo = 'T5800';

const busStopsDict = {
    "1006170": "KL2324 LRT AWAN BESAR",
    "1006173": "KL1291 KM1 BUKIT JALIL",
    "1000044": "KL2020 AFC (OPP)",
    "1003940": "KL2026 AURORA PLACE",
    "1000160": "KL1293 APARTMENT ARENA GREEN",
    "1001791": "KL151 LRT BKT JALIL",
    "1000612": "KL1320 ENDAH VILLA CONDOMINIUM",
    "1000613": "KL1321 APT SRI ENDAH (OPP)",
    "1000574": "KL2027 DEWAN SRI ENDAH",
    "1002306": "KL2028 FLAT SRI ENDAH",
    "1000103": "KL1322 APT TAMAN SRI ENDAH",
    "1001580": "KL2029 8 PETALING CONDOMINIUM",
    "1001564": "KL2031 KOMERSIAL SRI PETALING",
    "1003926": "KL1313 BANK ISLAM SRI PETALING",
    "1002884": "KL1306 ZON J, BANDAR BARU SRI PETALING (UTARA)",
    "1002907": "KL1307 ZON H, BANDAR BARU SRI PETALING (UTARA)",
    "1003024": "KL1308 ZON G, SRI PETALING (TIMUR)",
    "1000122": "KL1310 ENDAH RIA CONDOMINIUM",
    "1000611": "(M) KL1311 ENDAH PROMENADE",
    "1000449": "KL1312 ENDAH PARADE",
    "1001792": "KL149 LRT BKT JALIL",
    "1000161": "KL1299 APARTMENT ARENA GREEN (OPP)",
    "1000984": "KL1550 I SHOPPE TPM",
    "1001008": "KL2007 ENTERPRISE 3 TPM",
    "1002031": "KL2008 MAXIS TOC TPM",
    "1004139": "KL2009 TPM CARPARK",
    "1000176": "KL1540 ASTRO TPM",
    "1002032": "KL2010 MAXIS TOC TPM",
    "1004159": "KL1542 ENTERPRISE 3 TPM",
    "1001978": "KL1551 MAYBANK TPM",
    "1001072": "KL2018 CALVARY CONVENTION CENTRE",
    "1000111": "KL2019 ANJUNG HIJAU GREENFIELDS",
    "1006172": "KL1743 GREEN AVENUE CONDOMINIUM",
};

const orderedStopIds = [
    "1006173", "1000044", "1003940", "1000160", "1001791",
    "1000612", "1000613", "1000574", "1002306", "1000103", "1001580",
    "1001564", "1003926", "1002884", "1002907", "1003024", "1000122",
    "1000611", "1000449", "1001792", "1000161", "1000984", "1001008",
    "1002031", "1004139", "1000176", "1002032", "1004159", "1001978",
    "1001072", "1000111", "1006172", "1006170"
];

const schedules = [
    "0600", "0640", "0720", "0800", "0850", "0940",
    "1030", "1120", "1210", "1300", "1350", "1440",
    "1530", "1620", "1710", "1800", "1850", "1940",
    "2030", "2140", "2250", "2400"
]

const busStopsCoor = {
    "1006170": [3.061769, 101.669737],
    "1006173": [3.058376, 101.674439],
    "1000044": [3.056044, 101.673215],
    "1003940": [3.054211, 101.669275],
    "1000160": [3.053789, 101.688308],
    "1001791": [3.058519, 101.691519],
    "1000612": [3.064724, 101.691842],
    "1000613": [3.064294, 101.691108],
    "1000574": [3.064210, 101.687816],
    "1002306": [3.063842, 101.688911],
    "1000103": [3.064179, 101.690972],
    "1001580": [3.066401, 101.690988],
    "1001564": [3.066817, 101.692536],
    "1003926": [3.068718, 101.695328],
    "1002884": [3.069572, 101.696299],
    "1002907": [3.069741, 101.699385],
    "1003024": [3.067680, 101.700770],
    "1000122": [3.064168, 101.699606],
    "1000611": [3.063937, 101.697406],
    "1000449": [3.063836, 101.695435],
    "1001792": [3.058047, 101.691406],
    "1000161": [3.051823, 101.688705],
    "1000984": [3.047908, 101.688859],
    "1001008": [3.048086, 101.691714],
    "1002031": [3.051657, 101.697283],
    "1004139": [3.055012, 101.702792],
    "1000176": [3.052423, 101.700636],
    "1002032": [3.051317, 101.697391],
    "1004159": [3.048593, 101.692752],
    "1001978": [3.047402, 101.688837],
    "1001072": [3.050626, 101.679712],
    "1000111": [3.055941, 101.675214],
    "1006172": [3.058659, 101.673981]
};

// const lrtStops = ['1006170', '1001791', '1001792']

const getNextBusTime = (schedules, numBus) => {
    const now = new Date();
    const options = { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' };
    const currentTime = now.toLocaleTimeString('en-GB', options).replace(":", "");
    var skipBus = 1;

    let nearestTime = schedules[0];
    if (numBus === 1 && parseInt(currentTime) < 2030) { // If the route missing 1 bus
        skipBus = 2;
    } 
    for (let i = 0; i < schedules.length; i += skipBus) {
        if (parseInt(currentTime) <= parseInt(schedules[i])) {
            nearestTime = schedules[i];
            break;
        }
    }

    return nearestTime;
};

const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
};

const BusTracker = () => {
    const [busStops, setBusStops] = useState([]); // Store the stops that have bus
    const [lastUpdateDict, setLastUpdateDict] = useState({}); // Last update GPS
    const [numBus, setNumBus] = useState(0); // Total number of bus
    const [numOperatingBus, setNumOperatingBus] = useState(0); // Number of ON TRIP bus
    const [numOffBus, setNumOffBus] = useState(0); // Number of OFF TRIP bus
    const busRef = useRef(null);
    const [nextBusTime, setNextBusTime] = useState("");

    useEffect(() => {
        document.title = "T580 RapidBus Tracker";
        const socket = io('https://rapidbus-socketio-avl.prasarana.com.my', {
            transports: ['websocket'], // Ensure only WebSocket transport is used
            upgrade: false
        });

        socket.on('connect', () => {
            console.log('Connected to the server');
            socket.emit('onFts-reload', {
                sid: 'm61bsvkqte5n2g3kjipp1rpbte3e02qo',
                uid: '',
                provider: 'RKL',
                route: routeNo
            });

            const interval = setInterval(() => {
                socket.emit('onFts-reload', {
                    sid: 'm61bsvkqte5n2g3kjipp1rpbte3e02qo',
                    uid: '',
                    provider: 'RKL',
                    route: 'T5800'
                });
            }, 40000);

            return () => clearInterval(interval); // Cleanup interval on component unmount
        });

        socket.on('onFts-client', (data) => {
            try {
                const binaryString = atob(data);
                const binaryLen = binaryString.length;
                const bytes = new Uint8Array(binaryLen);
                for (let i = 0; i < binaryLen; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const decompressedData = pako.inflate(bytes, { to: 'string' }); // Decompress
                const busData = JSON.parse(decompressedData); // Parse JSON
                console.log("BUS DATA: " + decompressedData);
                const newBusData = busData.filter(bus => bus.trip_rev_kind === '00' || bus.trip_rev_kind === '99');
                const filteredBusData = newBusData.filter(bus => bus.trip_no !== null);
                const time = getNextBusTime(schedules, newBusData.length);
                const onBusLength = busData.filter(bus => bus.trip_rev_kind === '00').length;
                const offBusLength = busData.filter(bus => bus.trip_rev_kind === '99').length;

                // const busLocations = filteredBusData.map(bus => bus.busstop_id);
                const busLocations = filteredBusData.filter(bus => {
                    const prevStopId = getCookie(bus.bus_no);
                    console.log((bus.bus_no) + " prev " + prevStopId);
                
                    // If busstop_id is null, use the value from the cookie
                    if (bus.busstop_id === null) {
                        if (prevStopId) {
                            console.log("use cookie: " + prevStopId);
                            bus.busstop_id = prevStopId;
                        }
                    }
                
                    // Exclude if it's at the first/second stop but just not on a recent trip
                    if (bus.busstop_id === orderedStopIds[0] || bus.busstop_id === orderedStopIds[1]) {
                        try {
                            let tripTime = (bus.trip_no).substring(8, 12);
                            const now = new Date();
                            const options = { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' };
                            const currentTime = now.toLocaleTimeString('en-GB', options).replace(":", "");
                            console.log(parseInt(tripTime) + " " + parseInt(currentTime));
                
                            if (parseInt(tripTime) - 5 >= parseInt(currentTime) || parseInt(tripTime) + 30 <= parseInt(currentTime)) {
                                // Case to exclude or use previous stop id
                                // trip 1940 now 1935
                                // trip 1940 now 2010
                                if (prevStopId) {
                                    console.log(bus.bus_no + " use prev " + prevStopId);
                                    bus.busstop_id = prevStopId;
                                } else {
                                    console.log("hide " + bus.bus_no);
                                    return false;
                                }
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                
                    // Store in cookie if not null
                    if (bus.busstop_id !== null) {
                        if (prevStopId) {
                            const dist = Math.abs(orderedStopIds.indexOf(bus.busstop_id) - orderedStopIds.indexOf(prevStopId));
                            if (dist > 8 && prevStopId !== '1001792') { // abnormal change of GPS (exclusion if the bus at LRT BKT JALIL)
                                console.log("abnormal GPS " + bus.bus_no + ", use back prev " + prevStopId);
                                bus.busstop_id = prevStopId;
                            } else {
                                if (prevStopId !== bus.busstop_id){
                                    console.log("1. new cookie for "+ bus.bus_no + " "+ bus.busstop_id);
                                    document.cookie = `${bus.bus_no}=${bus.busstop_id}; max-age=300`;   
                                }
                            }
                        } else {
                            if (prevStopId !== bus.busstop_id){
                                console.log("2. new cookie for "+ bus.bus_no + " "+ bus.busstop_id);
                                document.cookie = `${bus.bus_no}=${bus.busstop_id}; max-age=300`;
                            }
                        }
                    }
                
                    return true;
                }).map(bus => bus.busstop_id);

                const busLastUpdateDict = filteredBusData.reduce((acc, bus) => {
                    const busLatLng = { latitude: bus.latitude, longitude: bus.longitude };
                    var busDist = 1;
                    if (bus.latitude && bus.longitude){
                        const stopLatLng = { latitude: busStopsCoor[bus.busstop_id][0], longitude: busStopsCoor[bus.busstop_id][1] };
                        busDist = getDistance(busLatLng, stopLatLng);
                    }

                    acc[bus.busstop_id] = [bus.dt_gps, bus.bus_no, bus.speed, busDist];
                    return acc;
                }, {});

                setNextBusTime(time);
                setNumOffBus(offBusLength);
                setNumOperatingBus(onBusLength);
                setBusStops(busLocations);
                setLastUpdateDict(busLastUpdateDict);
                setNumBus(newBusData.length);
            } catch (error) {
                console.error('Error processing data:', error.stack);
            }
        });

        return () => {
            socket.disconnect(); // Clean up socket connection on component unmount
        };
    }, []);

    useEffect(() => {
        if (busRef.current) {
            busRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [busStops]); // Trigger scrolling when busStops are updated

    return (
        <div className="main-container">
            <div className="table-header">
                <h1>Real-Time Bus Tracker for {routeNo}</h1>
                <p>Stesen LRT Awan Besar ~ TPM via Stesen LRT Bukit Jalil</p>
                <span className='total-bus'>Total buses: {numBus}</span><br />
                <span className='ontrip-bus'>ON TRIP buses: {numOperatingBus}</span><br />
                <span className='offtrip-bus'>OFF TRIP buses: {numOffBus}</span>
            </div>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Bus Stop</th>
                            <th>Bus Present</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className='terminal-stop'><td colSpan={2}>Next estimated bus from {busStopsDict[orderedStopIds[orderedStopIds.length - 1]]} at <b>{nextBusTime}H</b></td></tr>
                        {orderedStopIds.map(stopId => (
                            <tr
                                key={stopId}
                                className={`stop-${stopId}`}
                                ref={busStops.includes(stopId) && !busRef.current && (orderedStopIds.slice(5, -5)).includes(stopId) ? busRef : null}
                            >
                                <td>
                                    {busStops.includes(stopId) ? (
                                        <>
                                            🚏
                                        </>
                                    ) : ""}
                                    {busStopsDict[stopId]}
                                </td>
                                <td className='emoji'>
                                    {busStops.includes(stopId) ? (
                                        <div className='bus-info'>
                                            <span role="img" aria-label="bus" title={lastUpdateDict[stopId][1]}>🚍 </span>
                                            <span className='speed'>{lastUpdateDict[stopId][1]} : {lastUpdateDict[stopId][2]} km/h</span>
                                            <span className='update'>
                                                Update: {lastUpdateDict[stopId][0]}
                                            </span>
                                            <span className='distance'>
                                                {lastUpdateDict[stopId][3]} meters ahead
                                            </span>
                                        </div>
                                    ) : ""}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BusTracker;