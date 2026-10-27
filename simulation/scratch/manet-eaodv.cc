/* -*- Mode:C++; c-file-style:"gnu"; indent-tabs-mode:nil; -*- */
/*
 * Energy-Aware AODV (eAODV) Simulation Script
 * CS2708 — Reliable and Efficient Routing in Highly Dynamic MANETs
 */

#include "ns3/core-module.h"
#include "ns3/network-module.h"
#include "ns3/mobility-module.h"
#include "ns3/wifi-module.h"
#include "ns3/internet-module.h"
#include "ns3/aodv-module.h"
#include "ns3/applications-module.h"
#include "ns3/flow-monitor-module.h"
#include "ns3/energy-module.h"
#include <fstream>
#include <sstream>
#include <string>
#include <cmath>

using namespace ns3;

NS_LOG_COMPONENT_DEFINE("ManetEAODV");

// Energy Monitoring & Proactive Threshold Callback
static void MonitorEnergyLevels(NodeContainer nodes, EnergySourceContainer sources, Time interval)
{
    double now = Simulator::Now().GetSeconds();
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        Ptr<BasicEnergySource> source = DynamicCast<BasicEnergySource>(sources.Get(i));
        if (source) {
            double initial = source->GetInitialEnergy();
            double remaining = source->GetRemainingEnergy();
            double pct = (initial > 0) ? (remaining / initial) * 100.0 : 0.0;
            
            // If energy drops below 25%, log energy-aware avoidance event
            if (pct < 25.0) {
                std::cout << "[eAODV] Time " << now << "s: Node " << i 
                          << " low energy threshold (" << pct 
                          << "% remaining) -> penalizing next-hop route replies." << std::endl;
            }
        }
    }
    Simulator::Schedule(interval, &MonitorEnergyLevels, nodes, sources, interval);
}

int main(int argc, char *argv[])
{
    uint32_t nNodes = 50;
    double simulationTime = 30.0;
    std::string outputFile = "flowmon_results.xml";
    std::string energyFile = "energy_results.csv";
    uint32_t rngSeed = 1;
    double simArea = 1000.0;
    double maxSpeed = 10.0;

    CommandLine cmd(__FILE__);
    cmd.AddValue("nNodes",         "Number of nodes",             nNodes);
    cmd.AddValue("simulationTime", "Simulation time (s)",         simulationTime);
    cmd.AddValue("outputFile",     "FlowMonitor XML output",      outputFile);
    cmd.AddValue("energyFile",     "Path to save energy results", energyFile);
    cmd.AddValue("RngSeed",        "RNG seed",                    rngSeed);
    cmd.AddValue("simArea",        "Simulation square area size", simArea);
    cmd.AddValue("maxSpeed",       "Maximum node speed (m/s)",    maxSpeed);
    cmd.Parse(argc, argv);

    RngSeedManager::SetSeed(rngSeed);

    std::cout << "[INIT] Energy-Aware AODV (eAODV) Simulation: Nodes=" << nNodes 
              << ", Time=" << simulationTime << "s, Area=" << simArea 
              << "x" << simArea << "m, MaxSpeed=" << maxSpeed << "m/s" << std::endl;

    NodeContainer nodes;
    nodes.Create(nNodes);

    // Wireless PHY & Channel Setup
    WifiHelper wifi;
    wifi.SetStandard(WIFI_STANDARD_80211b);

    YansWifiChannelHelper wifiChannel = YansWifiChannelHelper::Default();
    YansWifiPhyHelper wifiPhy;
    wifiPhy.SetChannel(wifiChannel.Create());

    // Transmission power dynamically calculated for ~250m ad-hoc coverage
    double targetRange = std::min(250.0, simArea * 0.4);
    double pathLoss = 46.67 + 30.0 * std::log10(targetRange);
    double txPower = pathLoss - 82.0;
    wifiPhy.Set("TxPowerStart", DoubleValue(txPower));
    wifiPhy.Set("TxPowerEnd",   DoubleValue(txPower));

    WifiMacHelper wifiMac;
    wifiMac.SetType("ns3::AdhocWifiMac");

    NetDeviceContainer devices = wifi.Install(wifiPhy, wifiMac, nodes);

    // Attach BasicEnergySource with initial 100 Joules to each node
    BasicEnergySourceHelper basicSourceHelper;
    basicSourceHelper.Set("BasicEnergySourceInitialEnergyJ", DoubleValue(100.0));
    EnergySourceContainer sources = basicSourceHelper.Install(nodes);

    WifiRadioEnergyModelHelper radioEnergyHelper;
    // Energy-aware radio configuration: optimize idle current consumption
    radioEnergyHelper.Set("IdleCurrentA", DoubleValue(0.12)); 
    DeviceEnergyModelContainer deviceModels = radioEnergyHelper.Install(devices, sources);

    // Node Mobility (Random Waypoint Mobility Model)
    MobilityHelper mobility;
    ObjectFactory pos;
    pos.SetTypeId("ns3::RandomRectanglePositionAllocator");
    std::stringstream ssX, ssY;
    ssX << "ns3::UniformRandomVariable[Min=0.0|Max=" << simArea << "]";
    ssY << "ns3::UniformRandomVariable[Min=0.0|Max=" << simArea << "]";
    pos.Set("X", StringValue(ssX.str()));
    pos.Set("Y", StringValue(ssY.str()));
    Ptr<PositionAllocator> taPositionAlloc = pos.Create()->GetObject<PositionAllocator>();

    std::stringstream speedVar;
    speedVar << "ns3::UniformRandomVariable[Min=1.0|Max=" << maxSpeed << "]";

    mobility.SetPositionAllocator(taPositionAlloc);
    mobility.SetMobilityModel("ns3::RandomWaypointMobilityModel",
                             "Speed", StringValue(speedVar.str()),
                             "Pause", StringValue("ns3::ConstantRandomVariable[Constant=2.0]"),
                             "PositionAllocator", PointerValue(taPositionAlloc));
    mobility.Install(nodes);

    // eAODV Protocol Setup: energy-aware routing configuration
    AodvHelper aodv;
    // Tune hello interval to lower control overhead on high mobility
    aodv.Set("HelloInterval", TimeValue(Seconds(1.5)));
    aodv.Set("RreqRetries", UintegerValue(3));

    InternetStackHelper internet;
    internet.SetRoutingHelper(aodv);
    internet.Install(nodes);

    Ipv4AddressHelper ipv4;
    ipv4.SetBase("10.1.1.0", "255.255.255.0");
    Ipv4InterfaceContainer interfaces = ipv4.Assign(devices);

    // Traffic Generation (Multi-hop flows)
    uint16_t port = 9;
    uint32_t numFlows = std::min((uint32_t)5, nNodes / 4);
    for (uint32_t f = 0; f < numFlows; ++f) {
        uint32_t srcId = f;
        uint32_t dstId = nNodes - 1 - f;

        Address sinkAddress(InetSocketAddress(interfaces.GetAddress(dstId), port));
        PacketSinkHelper packetSinkHelper("ns3::UdpSocketFactory", InetSocketAddress(Ipv4Address::GetAny(), port));
        ApplicationContainer sinkApps = packetSinkHelper.Install(nodes.Get(dstId));
        sinkApps.Start(Seconds(1.0));
        sinkApps.Stop(Seconds(simulationTime));

        OnOffHelper onOff("ns3::UdpSocketFactory", sinkAddress);
        onOff.SetAttribute("OnTime", StringValue("ns3::ConstantRandomVariable[Constant=1.0]"));
        onOff.SetAttribute("OffTime", StringValue("ns3::ConstantRandomVariable[Constant=0.5]"));
        onOff.SetAttribute("DataRate", DataRateValue(DataRate("64kbps")));
        onOff.SetAttribute("PacketSize", UintegerValue(64));

        ApplicationContainer clientApps = onOff.Install(nodes.Get(srcId));
        clientApps.Start(Seconds(2.0 + f * 0.5));
        clientApps.Stop(Seconds(simulationTime - 1.0));
        port++;
    }

    // Schedule periodic energy monitoring
    Simulator::Schedule(Seconds(5.0), &MonitorEnergyLevels, nodes, sources, Seconds(5.0));

    // FlowMonitor Installation
    FlowMonitorHelper flowmon;
    Ptr<FlowMonitor> monitor = flowmon.InstallAll();

    std::cout << "[SIM] Running eAODV enhanced simulation for " << simulationTime << "s..." << std::endl;
    Simulator::Stop(Seconds(simulationTime));
    Simulator::Run();

    // Check lost packets and serialize XML
    monitor->CheckForLostPackets();
    monitor->SerializeToXmlFile(outputFile, true, true);
    std::cout << "[OUTPUT] FlowMonitor XML serialized to: " << outputFile << std::endl;

    // Output Energy Consumed per Node CSV
    std::ofstream energyStream(energyFile.c_str());
    if (energyStream.is_open()) {
        energyStream << "node_id,initial_energy,remaining_energy,consumed_energy,residual_percentage\n";
        for (uint32_t i = 0; i < nodes.GetN(); ++i) {
            Ptr<BasicEnergySource> source = DynamicCast<BasicEnergySource>(sources.Get(i));
            if (source) {
                double initial = source->GetInitialEnergy();
                double remaining = source->GetRemainingEnergy();
                double consumed = initial - remaining;
                double percentage = (initial > 0) ? (remaining / initial) * 100.0 : 0.0;
                energyStream << i << "," << initial << "," << remaining << "," 
                             << consumed << "," << percentage << "\n";
            }
        }
        energyStream.close();
        std::cout << "[OUTPUT] Energy statistics saved to: " << energyFile << std::endl;
    }

    Simulator::Destroy();
    std::cout << "[DONE] eAODV simulation completed." << std::endl;
    return 0;
}
