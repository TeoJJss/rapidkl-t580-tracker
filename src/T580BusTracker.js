import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import pako from 'pako';
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

// const lrtStops = ['1006170', '1001791', '1001792']

const getNextBusTime = (schedules, numBus) => {
    const now = new Date();
    const options = { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' };
    const currentTime = now.toLocaleTimeString('en-GB', options).replace(":", "");
    var skipBus = 1;

    let nearestTime = schedules[0];
    if (numBus === 1) {
        skipBus = 2;
    } else if (numBus === 0) {
        skipBus = 0;
    }
    for (let i = 0; i < schedules.length; i += skipBus) {
        if (parseInt(currentTime) <= parseInt(schedules[i])) {
            nearestTime = schedules[i];
            console.log("nearest");
            break;
        }
    }

    return nearestTime;
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
                const filteredBusData = newBusData.filter(bus => bus.busstop_id !== null && bus.trip_no !== null);
                const time = getNextBusTime(schedules, newBusData.length);
                const onBusLength = busData.filter(bus => bus.trip_rev_kind === '00').length;
                const offBusLength = busData.filter(bus => bus.trip_rev_kind === '99').length;

                // const busLocations = filteredBusData.map(bus => bus.busstop_id);
                const busLocations = filteredBusData.filter(bus => {
                    // Exclude if it's at the first/second stop but just not on a recent trip
                    if (bus.busstop_id === orderedStopIds[0] || bus.busstop_id === orderedStopIds[2]){
                        try{
                            let tripTime = (bus.trip_no).substring(8, 12);
                            const now = new Date();
                            const options = { timeZone: 'Asia/Singapore', hour12: false, hour: '2-digit', minute: '2-digit' };
                            const currentTime = now.toLocaleTimeString('en-GB', options).replace(":", "");
                            console.log(parseInt(tripTime) +" "+ parseInt(currentTime));

                            if (parseInt(tripTime)-5 >= parseInt(currentTime) || parseInt(tripTime) + 30 <= parseInt(currentTime)){
                                // Case to exclude
                                // trip 1940 now 1935
                                // trip 1940 now 2010
                                return false;
                            }
                        }catch(err){
                            console.error(err);
                        }
                    }
                    
                    return true;
                }).map(bus => bus.busstop_id);;
                const busLastUpdateDict = filteredBusData.reduce((acc, bus) => {
                    acc[bus.busstop_id] = [bus.dt_gps, bus.bus_no, bus.speed];
                    return acc;
                }, {});

                setNextBusTime(time);
                setNumOffBus(offBusLength);
                setNumOperatingBus(onBusLength);
                setBusStops(busLocations);
                setLastUpdateDict(busLastUpdateDict);
                setNumBus(newBusData.length);
            } catch (error) {
                console.error('Error processing data:', error);
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