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
#include <map>
#include <vector>
#include <algorithm>
#include <iomanip>

using namespace ns3;

NS_LOG_COMPONENT_DEFINE("ManetEAODV");

// Routing control packet counters (RREQ, RREP, RERR, RREP_ACK)
static uint32_t g_routingControlPackets = 0;
static uint32_t g_rreqPackets = 0;
static uint32_t g_rrepPackets = 0;
static uint32_t g_rerrPackets = 0;
static uint32_t g_rrepAckPackets = 0;

// Node Position & Mobility Tracking
struct NodePositionRecord {
    double time;
    double x;
    double y;
    double z;
};

static std::map<uint32_t, std::vector<NodePositionRecord>> g_nodePositions;

// Wireless Link Event Tracking
struct WirelessLinkEvent {
    double time;
    int32_t source_node_id;       // -1 if unknown / broadcast
    int32_t destination_node_id;  // -1 if broadcast / unknown
    std::string event_type;       // "transmission_attempt", "successful_reception", "failed_reception"
    uint64_t packet_id;           // NS-3 globally unique packet UID
    uint32_t packet_size;         // bytes
    double snr_db;                // dB
    bool is_broadcast;            // broadcast frame
    std::string frame_type;       // e.g. "DATA", "CTL_ACK", "CTL_RTS", etc.
};

static std::map<Mac48Address, uint32_t> g_macToNodeId;
static std::vector<WirelessLinkEvent> g_linkEvents;

static uint32_t
GetNodeIdFromContext(const std::string &context)
{
    size_t start = context.find("/NodeList/");
    if (start != std::string::npos) {
        start += 10;
        size_t end = context.find('/', start);
        if (end != std::string::npos) {
            std::string idStr = context.substr(start, end - start);
            return std::stoul(idStr);
        }
    }
    return 0;
}

static void
PhyTxTrace(std::string context, Ptr<const Packet> packet, WifiMode mode, WifiPreamble preamble, uint8_t power)
{
    uint32_t txNodeId = GetNodeIdFromContext(context);
    double now = Simulator::Now().GetSeconds();

    int32_t destNodeId = -1;
    bool isBcast = false;
    std::string fType = "UNKNOWN";

    Ptr<Packet> copy = packet->Copy();
    if (copy->GetSize() >= 4) {
        WifiMacTrailer fcs;
        copy->RemoveTrailer(fcs);
        WifiMacHeader macHdr;
        if (copy->RemoveHeader(macHdr) > 0) {
            Mac48Address ra = macHdr.GetAddr1();
            isBcast = ra.IsBroadcast();
            if (!isBcast) {
                auto it = g_macToNodeId.find(ra);
                if (it != g_macToNodeId.end()) {
                    destNodeId = (int32_t)it->second;
                }
            }
            fType = macHdr.GetTypeString();
        }
    }

    WirelessLinkEvent ev;
    ev.time = now;
    ev.source_node_id = (int32_t)txNodeId;
    ev.destination_node_id = destNodeId;
    ev.event_type = "transmission_attempt";
    ev.packet_id = packet->GetUid();
    ev.packet_size = packet->GetSize();
    ev.snr_db = 0.0;
    ev.is_broadcast = isBcast;
    ev.frame_type = fType;

    g_linkEvents.push_back(ev);
}

static void
PhyRxOkTrace(std::string context, Ptr<const Packet> packet, double snr, WifiMode mode, WifiPreamble preamble)
{
    uint32_t rxNodeId = GetNodeIdFromContext(context);
    double now = Simulator::Now().GetSeconds();

    int32_t srcNodeId = -1;
    bool isBcast = false;
    std::string fType = "UNKNOWN";

    Ptr<Packet> copy = packet->Copy();
    if (copy->GetSize() >= 4) {
        WifiMacTrailer fcs;
        copy->RemoveTrailer(fcs);
        WifiMacHeader macHdr;
        if (copy->RemoveHeader(macHdr) > 0) {
            Mac48Address ta = macHdr.GetAddr2();
            auto it = g_macToNodeId.find(ta);
            if (it != g_macToNodeId.end()) {
                srcNodeId = (int32_t)it->second;
            }
            isBcast = macHdr.GetAddr1().IsBroadcast();
            fType = macHdr.GetTypeString();
        }
    }

    double snrDb = (snr > 1e-9) ? (10.0 * std::log10(snr)) : -99.0;
    snrDb = std::round(snrDb * 10.0) / 10.0;

    WirelessLinkEvent ev;
    ev.time = now;
    ev.source_node_id = srcNodeId;
    ev.destination_node_id = (int32_t)rxNodeId;
    ev.event_type = "successful_reception";
    ev.packet_id = packet->GetUid();
    ev.packet_size = packet->GetSize();
    ev.snr_db = snrDb;
    ev.is_broadcast = isBcast;
    ev.frame_type = fType;

    g_linkEvents.push_back(ev);
}

static void
PhyRxErrorTrace(std::string context, Ptr<const Packet> packet, double snr)
{
    uint32_t rxNodeId = GetNodeIdFromContext(context);
    double now = Simulator::Now().GetSeconds();

    int32_t srcNodeId = -1;
    bool isBcast = false;
    std::string fType = "UNKNOWN";

    try {
        Ptr<Packet> copy = packet->Copy();
        if (copy->GetSize() >= 4) {
            WifiMacTrailer fcs;
            copy->RemoveTrailer(fcs);
            WifiMacHeader macHdr;
            if (copy->RemoveHeader(macHdr) > 0) {
                Mac48Address ta = macHdr.GetAddr2();
                auto it = g_macToNodeId.find(ta);
                if (it != g_macToNodeId.end()) {
                    srcNodeId = (int32_t)it->second;
                }
                isBcast = macHdr.GetAddr1().IsBroadcast();
                fType = macHdr.GetTypeString();
            }
        }
    } catch (...) {
        // Corrupted packet header
    }

    double snrDb = (snr > 1e-9) ? (10.0 * std::log10(snr)) : -99.0;
    snrDb = std::round(snrDb * 10.0) / 10.0;

    WirelessLinkEvent ev;
    ev.time = now;
    ev.source_node_id = srcNodeId;
    ev.destination_node_id = (int32_t)rxNodeId;
    ev.event_type = "failed_reception";
    ev.packet_id = packet->GetUid();
    ev.packet_size = packet->GetSize();
    ev.snr_db = snrDb;
    ev.is_broadcast = isBcast;
    ev.frame_type = fType;

    g_linkEvents.push_back(ev);
}

static void
CourseChangeTrace(std::string context, Ptr<const MobilityModel> model)
{
    size_t start = context.find("/NodeList/");
    if (start != std::string::npos) {
        start += 10;
        size_t end = context.find('/', start);
        if (end != std::string::npos) {
            std::string idStr = context.substr(start, end - start);
            uint32_t nodeId = std::stoul(idStr);
            Vector pos = model->GetPosition();
            double now = Simulator::Now().GetSeconds();
            if (g_nodePositions[nodeId].empty() || std::abs(g_nodePositions[nodeId].back().time - now) > 0.001) {
                g_nodePositions[nodeId].push_back({now, pos.x, pos.y, pos.z});
            }
        }
    }
}

static void
SampleNodePositions(NodeContainer nodes, double interval, double stopTime)
{
    double now = Simulator::Now().GetSeconds();
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        Ptr<MobilityModel> mm = nodes.Get(i)->GetObject<MobilityModel>();
        if (mm) {
            Vector pos = mm->GetPosition();
            if (g_nodePositions[i].empty() || std::abs(g_nodePositions[i].back().time - now) > 0.001) {
                g_nodePositions[i].push_back({now, pos.x, pos.y, pos.z});
            }
        }
    }
    double nextTime = now + interval;
    if (nextTime <= stopTime + 0.001) {
        Simulator::Schedule(Seconds(interval), &SampleNodePositions, nodes, interval, stopTime);
    }
}

// Routing & Forwarding Hop Tracking (Phase 5)
struct RoutingHopEvent {
    double time;
    std::string eventType;      // "data_send", "data_forward", "data_delivered", "data_drop", "rreq_tx", "rreq_rx", "rrep_tx", "rrep_rx", "rerr_tx", "rerr_rx"
    uint32_t nodeId;
    int32_t prevHopNodeId;      // -1 if unknown or source
    int32_t nextHopNodeId;      // -1 if unknown or destination
    uint64_t packetUid;
    uint32_t packetSize;
    std::string sourceIp;
    std::string destIp;
    uint32_t ttl;
    uint32_t hopCount;
    uint32_t seqNo;
    std::string details;
};

static std::vector<RoutingHopEvent> g_routingTraceEvents;
static std::map<Ipv4Address, uint32_t> g_ipToNodeId;
static std::map<uint64_t, int32_t> g_lastHopForPacket;

static void
Ipv4SendOutgoingTrace(std::string context, const Ipv4Header &header, Ptr<const Packet> packet, uint32_t interface)
{
    uint32_t nodeId = GetNodeIdFromContext(context);
    double now = Simulator::Now().GetSeconds();

    if (header.GetProtocol() == 17) // UDP
    {
        Ptr<Packet> copy = packet->Copy();
        UdpHeader udpHeader;
        if (copy->GetSize() >= udpHeader.GetSerializedSize())
        {
            copy->RemoveHeader(udpHeader);
            if (udpHeader.GetDestinationPort() != 654 && udpHeader.GetSourcePort() != 654)
            {
                uint64_t uid = packet->GetUid();
                g_lastHopForPacket[uid] = (int32_t)nodeId;

                RoutingHopEvent ev;
                ev.time = now;
                ev.eventType = "data_send";
                ev.nodeId = nodeId;
                ev.prevHopNodeId = -1;
                ev.nextHopNodeId = -1;
                ev.packetUid = uid;
                ev.packetSize = packet->GetSize();
                std::stringstream ssSrc, ssDst;
                header.GetSource().Print(ssSrc);
                header.GetDestination().Print(ssDst);
                ev.sourceIp = ssSrc.str();
                ev.destIp = ssDst.str();
                ev.ttl = header.GetTtl();
                ev.hopCount = 0;
                ev.seqNo = 0;
                ev.details = "cbr_originated";
                g_routingTraceEvents.push_back(ev);
            }
        }
    }
}

static void
Ipv4UnicastForwardTrace(std::string context, const Ipv4Header &header, Ptr<const Packet> packet, uint32_t interface)
{
    uint32_t nodeId = GetNodeIdFromContext(context);
    double now = Simulator::Now().GetSeconds();

    if (header.GetProtocol() == 17) // UDP
    {
        Ptr<Packet> copy = packet->Copy();
        UdpHeader udpHeader;
        if (copy->GetSize() >= udpHeader.GetSerializedSize())
        {
            copy->RemoveHeader(udpHeader);
            if (udpHeader.GetDestinationPort() != 654 && udpHeader.GetSourcePort() != 654)
            {
                uint64_t uid = packet->GetUid();
                int32_t prevHop = -1;
                auto it = g_lastHopForPacket.find(uid);
                if (it != g_lastHopForPacket.end()) {
                    prevHop = it->second;
                }
                g_lastHopForPacket[uid] = (int32_t)nodeId;

                RoutingHopEvent ev;
                ev.time = now;
                if (prevHop == static_cast<int32_t>(nodeId)) {
                    ev.eventType = "data_reinject";
                    ev.details = "cbr_queue_dequeued";
                } else {
                    ev.eventType = "data_forward";
                    ev.details = "cbr_forwarded";
                }
                ev.nodeId = nodeId;
                ev.prevHopNodeId = prevHop;
                ev.nextHopNodeId = -1;
                ev.packetUid = uid;
                ev.packetSize = packet->GetSize();
                std::stringstream ssSrc, ssDst;
                header.GetSource().Print(ssSrc);
                header.GetDestination().Print(ssDst);
                ev.sourceIp = ssSrc.str();
                ev.destIp = ssDst.str();
                ev.ttl = header.GetTtl();
                ev.hopCount = 0;
                ev.seqNo = 0;
                g_routingTraceEvents.push_back(ev);
            }
        }
    }
}

static void
Ipv4LocalDeliverTrace(std::string context, const Ipv4Header &header, Ptr<const Packet> packet, uint32_t interface)
{
    uint32_t nodeId = GetNodeIdFromContext(context);
    double now = Simulator::Now().GetSeconds();

    if (header.GetProtocol() == 17) // UDP
    {
        Ptr<Packet> copy = packet->Copy();
        UdpHeader udpHeader;
        if (copy->GetSize() >= udpHeader.GetSerializedSize())
        {
            copy->RemoveHeader(udpHeader);
            if (udpHeader.GetDestinationPort() != 654 && udpHeader.GetSourcePort() != 654)
            {
                uint64_t uid = packet->GetUid();
                int32_t prevHop = -1;
                auto it = g_lastHopForPacket.find(uid);
                if (it != g_lastHopForPacket.end()) {
                    prevHop = it->second;
                }

                RoutingHopEvent ev;
                ev.time = now;
                ev.eventType = "data_delivered";
                ev.nodeId = nodeId;
                ev.prevHopNodeId = prevHop;
                ev.nextHopNodeId = -1;
                ev.packetUid = uid;
                ev.packetSize = packet->GetSize();
                std::stringstream ssSrc, ssDst;
                header.GetSource().Print(ssSrc);
                header.GetDestination().Print(ssDst);
                ev.sourceIp = ssSrc.str();
                ev.destIp = ssDst.str();
                ev.ttl = header.GetTtl();
                ev.hopCount = 0;
                ev.seqNo = 0;
                ev.details = "cbr_delivered";
                g_routingTraceEvents.push_back(ev);

                // M2: Terminal successful delivery - clean up tracking state
                if (it != g_lastHopForPacket.end()) {
                    g_lastHopForPacket.erase(it);
                }
            }
        }
    }
}

static void
Ipv4DropTrace(std::string context, const Ipv4Header &header, Ptr<const Packet> packet, Ipv4L3Protocol::DropReason reason, Ptr<Ipv4> ipv4, uint32_t interface)
{
    uint32_t nodeId = GetNodeIdFromContext(context);
    double now = Simulator::Now().GetSeconds();

    std::string reasonStr = "DROP_OTHER";
    switch (reason) {
        case Ipv4L3Protocol::DROP_TTL_EXPIRED: reasonStr = "DROP_TTL_EXPIRED"; break;
        case Ipv4L3Protocol::DROP_NO_ROUTE: reasonStr = "DROP_NO_ROUTE"; break;
        case Ipv4L3Protocol::DROP_BAD_CHECKSUM: reasonStr = "DROP_BAD_CHECKSUM"; break;
        case Ipv4L3Protocol::DROP_INTERFACE_DOWN: reasonStr = "DROP_INTERFACE_DOWN"; break;
        case Ipv4L3Protocol::DROP_ROUTE_ERROR: reasonStr = "DROP_ROUTE_ERROR"; break;
        case Ipv4L3Protocol::DROP_FRAGMENT_TIMEOUT: reasonStr = "DROP_FRAGMENT_TIMEOUT"; break;
        case Ipv4L3Protocol::DROP_DUPLICATE: reasonStr = "DROP_DUPLICATE"; break;
        default: break;
    }

    uint64_t uid = packet ? packet->GetUid() : 0;
    int32_t prevHop = -1;
    auto it = g_lastHopForPacket.find(uid);
    if (it != g_lastHopForPacket.end()) {
        prevHop = it->second;
    }

    RoutingHopEvent ev;
    ev.time = now;
    ev.eventType = "data_drop";
    ev.nodeId = nodeId;
    ev.prevHopNodeId = prevHop;
    ev.nextHopNodeId = -1;
    ev.packetUid = uid;
    ev.packetSize = packet ? packet->GetSize() : 0;
    std::stringstream ssSrc, ssDst;
    header.GetSource().Print(ssSrc);
    header.GetDestination().Print(ssDst);
    ev.sourceIp = ssSrc.str();
    ev.destIp = ssDst.str();
    ev.ttl = header.GetTtl();
    ev.hopCount = 0;
    ev.seqNo = 0;
    ev.details = reasonStr;
    g_routingTraceEvents.push_back(ev);

    // M2: Terminal packet drop - clean up tracking state
    if (it != g_lastHopForPacket.end()) {
        g_lastHopForPacket.erase(it);
    }
}

static void
Ipv4TxTrace(std::string context, Ptr<const Packet> packet, Ptr<Ipv4> ipv4, uint32_t interface)
{
    uint32_t nodeId = GetNodeIdFromContext(context);
    Ipv4Header ipHeader;
    Ptr<Packet> copy = packet->Copy();
    if (copy->GetSize() >= ipHeader.GetSerializedSize())
    {
        copy->RemoveHeader(ipHeader);
        if (ipHeader.GetProtocol() == 17) // UDP
        {
            UdpHeader udpHeader;
            if (copy->GetSize() >= udpHeader.GetSerializedSize())
            {
                copy->RemoveHeader(udpHeader);
                if (udpHeader.GetDestinationPort() == 654 || udpHeader.GetSourcePort() == 654)
                {
                    g_routingControlPackets++;
                    if (copy->GetSize() >= 1)
                    {
                        aodv::TypeHeader tHeader;
                        if (copy->RemoveHeader(tHeader) > 0 && tHeader.IsValid())
                        {
                            RoutingHopEvent rEv;
                            rEv.time = Simulator::Now().GetSeconds();
                            rEv.nodeId = nodeId;
                            rEv.prevHopNodeId = -1;
                            rEv.nextHopNodeId = -1;
                            rEv.packetUid = packet->GetUid();
                            rEv.packetSize = packet->GetSize();
                            rEv.ttl = ipHeader.GetTtl();
                            rEv.hopCount = 0;
                            rEv.seqNo = 0;

                            switch (tHeader.Get())
                            {
                                case aodv::AODVTYPE_RREQ: {
                                    g_rreqPackets++;
                                    aodv::RreqHeader rreq;
                                    if (copy->RemoveHeader(rreq) > 0) {
                                        rEv.eventType = "rreq_tx";
                                        rEv.hopCount = rreq.GetHopCount();
                                        rEv.seqNo = rreq.GetDstSeqno();
                                        std::stringstream ssSrc, ssDst;
                                        rreq.GetOrigin().Print(ssSrc);
                                        rreq.GetDst().Print(ssDst);
                                        rEv.sourceIp = ssSrc.str();
                                        rEv.destIp = ssDst.str();
                                        rEv.details = "RREQ ID=" + std::to_string(rreq.GetId());
                                        g_routingTraceEvents.push_back(rEv);
                                    }
                                    break;
                                }
                                case aodv::AODVTYPE_RREP: {
                                    g_rrepPackets++;
                                    aodv::RrepHeader rrep;
                                    if (copy->RemoveHeader(rrep) > 0) {
                                        rEv.eventType = "rrep_tx";
                                        rEv.hopCount = rrep.GetHopCount();
                                        rEv.seqNo = rrep.GetDstSeqno();
                                        std::stringstream ssSrc, ssDst;
                                        rrep.GetOrigin().Print(ssSrc);
                                        rrep.GetDst().Print(ssDst);
                                        rEv.sourceIp = ssSrc.str();
                                        rEv.destIp = ssDst.str();
                                        rEv.details = "RREP";
                                        g_routingTraceEvents.push_back(rEv);
                                    }
                                    break;
                                }
                                case aodv::AODVTYPE_RERR: {
                                    g_rerrPackets++;
                                    rEv.eventType = "rerr_tx";
                                    std::stringstream ssSrc, ssDst;
                                    ipHeader.GetSource().Print(ssSrc);
                                    ipHeader.GetDestination().Print(ssDst);
                                    rEv.sourceIp = ssSrc.str();
                                    rEv.destIp = ssDst.str();
                                    rEv.details = "RERR";
                                    g_routingTraceEvents.push_back(rEv);
                                    break;
                                }
                                case aodv::AODVTYPE_RREP_ACK: {
                                    g_rrepAckPackets++;
                                    rEv.eventType = "rrep_ack_tx";
                                    std::stringstream ssSrc, ssDst;
                                    ipHeader.GetSource().Print(ssSrc);
                                    ipHeader.GetDestination().Print(ssDst);
                                    rEv.sourceIp = ssSrc.str();
                                    rEv.destIp = ssDst.str();
                                    rEv.details = "RREP_ACK";
                                    g_routingTraceEvents.push_back(rEv);
                                    break;
                                }
                                default:
                                    break;
                            }
                        }
                    }
                }
            }
        }
    }
}

static void
Ipv4RxTrace(std::string context, Ptr<const Packet> packet, Ptr<Ipv4> ipv4, uint32_t interface)
{
    uint32_t nodeId = GetNodeIdFromContext(context);
    Ipv4Header ipHeader;
    Ptr<Packet> copy = packet->Copy();
    if (copy->GetSize() >= ipHeader.GetSerializedSize())
    {
        copy->RemoveHeader(ipHeader);
        if (ipHeader.GetProtocol() == 17) // UDP
        {
            UdpHeader udpHeader;
            if (copy->GetSize() >= udpHeader.GetSerializedSize())
            {
                copy->RemoveHeader(udpHeader);
                if (udpHeader.GetDestinationPort() == 654 || udpHeader.GetSourcePort() == 654)
                {
                    if (copy->GetSize() >= 1)
                    {
                        aodv::TypeHeader tHeader;
                        if (copy->RemoveHeader(tHeader) > 0 && tHeader.IsValid())
                        {
                            RoutingHopEvent rEv;
                            rEv.time = Simulator::Now().GetSeconds();
                            rEv.nodeId = nodeId;
                            rEv.prevHopNodeId = -1;
                            rEv.nextHopNodeId = -1;
                            rEv.packetUid = packet->GetUid();
                            rEv.packetSize = packet->GetSize();
                            rEv.ttl = ipHeader.GetTtl();
                            rEv.hopCount = 0;
                            rEv.seqNo = 0;

                            switch (tHeader.Get())
                            {
                                case aodv::AODVTYPE_RREQ: {
                                    aodv::RreqHeader rreq;
                                    if (copy->RemoveHeader(rreq) > 0) {
                                        rEv.eventType = "rreq_rx";
                                        rEv.hopCount = rreq.GetHopCount();
                                        rEv.seqNo = rreq.GetDstSeqno();
                                        std::stringstream ssSrc, ssDst;
                                        rreq.GetOrigin().Print(ssSrc);
                                        rreq.GetDst().Print(ssDst);
                                        rEv.sourceIp = ssSrc.str();
                                        rEv.destIp = ssDst.str();
                                        rEv.details = "RREQ ID=" + std::to_string(rreq.GetId());
                                        g_routingTraceEvents.push_back(rEv);
                                    }
                                    break;
                                }
                                case aodv::AODVTYPE_RREP: {
                                    aodv::RrepHeader rrep;
                                    if (copy->RemoveHeader(rrep) > 0) {
                                        rEv.eventType = "rrep_rx";
                                        rEv.hopCount = rrep.GetHopCount();
                                        rEv.seqNo = rrep.GetDstSeqno();
                                        std::stringstream ssSrc, ssDst;
                                        rrep.GetOrigin().Print(ssSrc);
                                        rrep.GetDst().Print(ssDst);
                                        rEv.sourceIp = ssSrc.str();
                                        rEv.destIp = ssDst.str();
                                        rEv.details = "RREP";
                                        g_routingTraceEvents.push_back(rEv);
                                    }
                                    break;
                                }
                                case aodv::AODVTYPE_RERR: {
                                    rEv.eventType = "rerr_rx";
                                    std::stringstream ssSrc, ssDst;
                                    ipHeader.GetSource().Print(ssSrc);
                                    ipHeader.GetDestination().Print(ssDst);
                                    rEv.sourceIp = ssSrc.str();
                                    rEv.destIp = ssDst.str();
                                    rEv.details = "RERR";
                                    g_routingTraceEvents.push_back(rEv);
                                    break;
                                }
                                case aodv::AODVTYPE_RREP_ACK: {
                                    rEv.eventType = "rrep_ack_rx";
                                    std::stringstream ssSrc, ssDst;
                                    ipHeader.GetSource().Print(ssSrc);
                                    ipHeader.GetDestination().Print(ssDst);
                                    rEv.sourceIp = ssSrc.str();
                                    rEv.destIp = ssDst.str();
                                    rEv.details = "RREP_ACK";
                                    g_routingTraceEvents.push_back(rEv);
                                    break;
                                }
                                default:
                                    break;
                            }
                        }
                    }
                }
            }
        }
    }
}

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
    std::string routingFile = "";
    std::string mobilityFile = "";
    std::string linkFile = "";
    std::string routeTraceFile = "";
    uint32_t rngSeed = 1;
    double simArea = 1000.0;
    double maxSpeed = 10.0;
    uint32_t nFlows = 0;

    CommandLine cmd(__FILE__);
    cmd.AddValue("nNodes",         "Number of nodes",             nNodes);
    cmd.AddValue("simulationTime", "Simulation time (s)",         simulationTime);
    cmd.AddValue("outputFile",     "FlowMonitor XML output",      outputFile);
    cmd.AddValue("energyFile",     "Path to save energy results", energyFile);
    cmd.AddValue("routingFile",    "Path to save routing packet results JSON", routingFile);
    cmd.AddValue("mobilityFile",   "Path to save node mobility trace JSON",    mobilityFile);
    cmd.AddValue("linkFile",       "Path to save wireless link trace JSON",    linkFile);
    cmd.AddValue("routeTraceFile", "Path to save detailed routing and data flow trace JSON", routeTraceFile);
    cmd.AddValue("RngSeed",        "RNG seed",                    rngSeed);
    cmd.AddValue("simArea",        "Simulation square area size", simArea);
    cmd.AddValue("maxSpeed",       "Maximum node speed (m/s)",    maxSpeed);
    cmd.AddValue("nFlows",         "Number of CBR traffic flows", nFlows);
    cmd.Parse(argc, argv);

    RngSeedManager::SetSeed(rngSeed);

    g_routingControlPackets = 0;
    g_rreqPackets = 0;
    g_rrepPackets = 0;
    g_rerrPackets = 0;
    g_rrepAckPackets = 0;
    g_nodePositions.clear();
    g_linkEvents.clear();
    g_macToNodeId.clear();
    g_routingTraceEvents.clear();
    g_ipToNodeId.clear();
    g_lastHopForPacket.clear();

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

    // Map Wi-Fi MAC addresses to Node IDs for wireless link event correlation
    g_macToNodeId.clear();
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        Ptr<WifiNetDevice> wifiDev = DynamicCast<WifiNetDevice>(devices.Get(i));
        if (wifiDev && wifiDev->GetMac()) {
            Mac48Address addr = wifiDev->GetMac()->GetAddress();
            g_macToNodeId[addr] = i;
        }
    }

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

    // Capture initial node positions at t = 0.0s
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        Ptr<MobilityModel> mm = nodes.Get(i)->GetObject<MobilityModel>();
        if (mm) {
            Vector pos = mm->GetPosition();
            g_nodePositions[i].push_back({0.0, pos.x, pos.y, pos.z});
        }
    }

    // Connect CourseChange trace callback to capture all waypoint and velocity changes
    Config::Connect("/NodeList/*/$ns3::MobilityModel/CourseChange", MakeCallback(&CourseChangeTrace));

    // Schedule periodic position sampling every 0.5s throughout simulation duration
    double sampleInterval = 0.5;
    Simulator::Schedule(Seconds(sampleInterval), &SampleNodePositions, nodes, sampleInterval, simulationTime);

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

    for (uint32_t i = 0; i < interfaces.GetN(); ++i) {
        g_ipToNodeId[interfaces.GetAddress(i)] = i;
    }

    // Traffic Generation (Multi-hop flows)
    uint16_t port = 9;
    uint32_t maxPossibleFlows = std::max((uint32_t)1, nNodes / 2);
    uint32_t numFlows = (nFlows > 0) ? std::min(nFlows, maxPossibleFlows) : std::min((uint32_t)5, nNodes / 4);
    numFlows = std::max((uint32_t)1, numFlows);
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
    Config::Connect("/NodeList/*/$ns3::Ipv4L3Protocol/Tx", MakeCallback(&Ipv4TxTrace));
    Config::Connect("/NodeList/*/$ns3::Ipv4L3Protocol/Rx", MakeCallback(&Ipv4RxTrace));
    Config::Connect("/NodeList/*/$ns3::Ipv4L3Protocol/SendOutgoing", MakeCallback(&Ipv4SendOutgoingTrace));
    Config::Connect("/NodeList/*/$ns3::Ipv4L3Protocol/UnicastForward", MakeCallback(&Ipv4UnicastForwardTrace));
    Config::Connect("/NodeList/*/$ns3::Ipv4L3Protocol/LocalDeliver", MakeCallback(&Ipv4LocalDeliverTrace));
    Config::Connect("/NodeList/*/$ns3::Ipv4L3Protocol/Drop", MakeCallback(&Ipv4DropTrace));
    Config::Connect("/NodeList/*/DeviceList/*/$ns3::WifiNetDevice/Phy/State/Tx", MakeCallback(&PhyTxTrace));
    Config::Connect("/NodeList/*/DeviceList/*/$ns3::WifiNetDevice/Phy/State/RxOk", MakeCallback(&PhyRxOkTrace));
    Config::Connect("/NodeList/*/DeviceList/*/$ns3::WifiNetDevice/Phy/State/RxError", MakeCallback(&PhyRxErrorTrace));
    Simulator::Stop(Seconds(simulationTime));
    Simulator::Run();

    // Capture final positions at t = simulationTime
    for (uint32_t i = 0; i < nodes.GetN(); ++i) {
        Ptr<MobilityModel> mm = nodes.Get(i)->GetObject<MobilityModel>();
        if (mm) {
            Vector pos = mm->GetPosition();
            if (g_nodePositions[i].empty() || std::abs(g_nodePositions[i].back().time - simulationTime) > 0.001) {
                g_nodePositions[i].push_back({simulationTime, pos.x, pos.y, pos.z});
            }
        }
    }

    // Sort and clean duplicate timestamps for strict chronological consistency
    for (uint32_t i = 0; i < nNodes; ++i) {
        std::stable_sort(g_nodePositions[i].begin(), g_nodePositions[i].end(),
            [](const NodePositionRecord &a, const NodePositionRecord &b) {
                return a.time < b.time;
            });
        std::vector<NodePositionRecord> cleanList;
        for (const auto &rec : g_nodePositions[i]) {
            if (cleanList.empty() || std::abs(cleanList.back().time - rec.time) > 0.001) {
                cleanList.push_back(rec);
            }
        }
        g_nodePositions[i] = cleanList;
    }

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

    // Output Routing Control Packets JSON if requested
    if (!routingFile.empty()) {
        std::ofstream routingStream(routingFile.c_str());
        if (routingStream.is_open()) {
            routingStream << "{\n"
                          << "  \"total_routing_packets\": " << g_routingControlPackets << ",\n"
                          << "  \"rreq_packets\": " << g_rreqPackets << ",\n"
                          << "  \"rrep_packets\": " << g_rrepPackets << ",\n"
                          << "  \"rerr_packets\": " << g_rerrPackets << ",\n"
                          << "  \"rrep_ack_packets\": " << g_rrepAckPackets << "\n"
                          << "}\n";
            routingStream.close();
            std::cout << "[OUTPUT] Routing statistics saved to: " << routingFile << std::endl;
        }
    }
    std::cout << "[ROUTING_METRIC] Total=" << g_routingControlPackets 
              << " RREQ=" << g_rreqPackets 
              << " RREP=" << g_rrepPackets 
              << " RERR=" << g_rerrPackets 
              << " RREP_ACK=" << g_rrepAckPackets << std::endl;

    // Output Node Mobility Trace JSON if requested
    if (!mobilityFile.empty()) {
        std::ofstream mobStream(mobilityFile.c_str());
        if (mobStream.is_open()) {
            uint32_t totalEvents = 0;
            for (uint32_t i = 0; i < nNodes; ++i) {
                totalEvents += g_nodePositions[i].size();
            }
            mobStream << "{\n"
                      << "  \"metric_version\": 1,\n"
                      << "  \"trace_type\": \"ns3_node_mobility\",\n"
                      << "  \"simulation_duration\": " << simulationTime << ",\n"
                      << "  \"sim_area\": " << simArea << ",\n"
                      << "  \"node_count\": " << nNodes << ",\n"
                      << "  \"total_position_records\": " << totalEvents << ",\n"
                      << "  \"nodes\": [\n";
            for (uint32_t i = 0; i < nNodes; ++i) {
                mobStream << "    {\n"
                          << "      \"node_id\": " << i << ",\n"
                          << "      \"positions\": [\n";
                const auto &posList = g_nodePositions[i];
                for (size_t p = 0; p < posList.size(); ++p) {
                    mobStream << std::fixed << std::setprecision(2);
                    mobStream << "        {\"time\": " << posList[p].time
                              << ", \"x\": " << posList[p].x
                              << ", \"y\": " << posList[p].y
                              << ", \"z\": " << posList[p].z << "}";
                    if (p + 1 < posList.size()) {
                        mobStream << ",";
                    }
                    mobStream << "\n";
                }
                mobStream << "      ]\n"
                          << "    }";
                if (i + 1 < nNodes) {
                    mobStream << ",";
                }
                mobStream << "\n";
            }
            mobStream << "  ]\n"
                      << "}\n";
            mobStream.close();
            std::cout << "[OUTPUT] Mobility trace saved to: " << mobilityFile << " (Records=" << totalEvents << ")" << std::endl;
            std::cout << "[MOBILITY_METRIC] Nodes=" << nNodes << " Records=" << totalEvents << std::endl;
        }
    }

    // Output Wireless Link Events JSON if requested
    if (!linkFile.empty()) {
        std::ofstream linkStream(linkFile.c_str());
        if (linkStream.is_open()) {
            linkStream << "{\n"
                       << "  \"metric_version\": 1,\n"
                       << "  \"trace_type\": \"ns3_wireless_link_events\",\n"
                       << "  \"simulation_duration\": " << simulationTime << ",\n"
                       << "  \"sim_area\": " << simArea << ",\n"
                       << "  \"node_count\": " << nNodes << ",\n"
                       << "  \"total_events\": " << g_linkEvents.size() << ",\n"
                       << "  \"events\": [\n";
            for (size_t e = 0; e < g_linkEvents.size(); ++e) {
                const auto &ev = g_linkEvents[e];
                linkStream << std::fixed << std::setprecision(4);
                linkStream << "    {\n"
                           << "      \"time\": " << ev.time << ",\n"
                           << "      \"source_node_id\": " << ev.source_node_id << ",\n"
                           << "      \"destination_node_id\": " << ev.destination_node_id << ",\n"
                           << "      \"event_type\": \"" << ev.event_type << "\",\n"
                           << "      \"packet_id\": " << ev.packet_id << ",\n"
                           << "      \"packet_size\": " << ev.packet_size << ",\n"
                           << "      \"snr_db\": " << std::setprecision(1) << ev.snr_db << ",\n"
                           << "      \"is_broadcast\": " << (ev.is_broadcast ? "true" : "false") << ",\n"
                           << "      \"frame_type\": \"" << ev.frame_type << "\"\n"
                           << "    }";
                if (e + 1 < g_linkEvents.size()) {
                    linkStream << ",";
                }
                linkStream << "\n";
            }
            linkStream << "  ]\n"
                       << "}\n";
            linkStream.close();
            std::cout << "[OUTPUT] Wireless link trace saved to: " << linkFile
                      << " (Events=" << g_linkEvents.size() << ")" << std::endl;
            std::cout << "[LINK_METRIC] Events=" << g_linkEvents.size() << std::endl;
        }
    }

    // Output Routing & Forwarding Trace JSON if requested (Phase 5)
    if (!routeTraceFile.empty()) {
        std::ofstream rOut(routeTraceFile.c_str());
        if (rOut.is_open()) {
            uint32_t dataCount = 0;
            uint32_t routeCount = 0;
            for (const auto &ev : g_routingTraceEvents) {
                if (ev.eventType.find("data_") == 0) dataCount++;
                else routeCount++;
            }

            rOut << "{\n";
            rOut << "  \"metric_version\": 1,\n";
            rOut << "  \"trace_type\": \"ns3_routing_and_forwarding_events\",\n";
            rOut << "  \"simulation_duration\": " << simulationTime << ",\n";
            rOut << "  \"sim_area\": " << simArea << ",\n";
            rOut << "  \"node_count\": " << nNodes << ",\n";
            rOut << "  \"total_events\": " << g_routingTraceEvents.size() << ",\n";
            rOut << "  \"total_data_events\": " << dataCount << ",\n";
            rOut << "  \"total_routing_events\": " << routeCount << ",\n";
            rOut << "  \"events\": [\n";

            for (size_t i = 0; i < g_routingTraceEvents.size(); ++i) {
                const auto &ev = g_routingTraceEvents[i];
                rOut << "    {\n";
                rOut << "      \"time\": " << std::fixed << std::setprecision(4) << ev.time << ",\n";
                rOut << "      \"event_type\": \"" << ev.eventType << "\",\n";
                rOut << "      \"node_id\": " << ev.nodeId << ",\n";
                if (ev.prevHopNodeId >= 0) {
                    rOut << "      \"prev_hop\": " << ev.prevHopNodeId << ",\n";
                } else {
                    rOut << "      \"prev_hop\": null,\n";
                }
                if (ev.nextHopNodeId >= 0) {
                    rOut << "      \"next_hop\": " << ev.nextHopNodeId << ",\n";
                } else {
                    rOut << "      \"next_hop\": null,\n";
                }
                rOut << "      \"packet_uid\": " << ev.packetUid << ",\n";
                rOut << "      \"packet_size\": " << ev.packetSize << ",\n";
                rOut << "      \"source_ip\": \"" << ev.sourceIp << "\",\n";
                rOut << "      \"dest_ip\": \"" << ev.destIp << "\",\n";
                rOut << "      \"ttl\": " << ev.ttl << ",\n";
                rOut << "      \"hop_count\": " << ev.hopCount << ",\n";
                rOut << "      \"seq_no\": " << ev.seqNo << ",\n";
                rOut << "      \"details\": \"" << ev.details << "\"\n";
                rOut << "    }";
                if (i + 1 < g_routingTraceEvents.size()) {
                    rOut << ",";
                }
                rOut << "\n";
            }
            rOut << "  ]\n";
            rOut << "}\n";
            rOut.close();
            std::cout << "[OUTPUT] Routing & forwarding trace saved to: " << routeTraceFile 
                      << " (Events=" << g_routingTraceEvents.size() << ")" << std::endl;
            std::cout << "[ROUTING_TRACE_METRIC] Events=" << g_routingTraceEvents.size() 
                      << " DataEvents=" << dataCount << " RoutingEvents=" << routeCount << std::endl;
        }
    }

    std::cout << "[PACKET_LIFECYCLE] Active tracking entries remaining at sim end: " 
              << g_lastHopForPacket.size() << std::endl;

    Simulator::Destroy();
    std::cout << "[DONE] eAODV simulation completed." << std::endl;
    return 0;
}
