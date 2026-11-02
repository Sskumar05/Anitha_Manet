import os
import re
import csv
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, Optional, List

def parse_flowmon_xml(xml_path: Path, routing_control_packets: Optional[int] = None) -> Dict[str, Any]:
    """
    Parses NS-3 FlowMonitor XML output and extracts pure user-data network metrics:
    - Packet Delivery Ratio (PDR): (total_data_rx_packets / total_data_tx_packets) * 100
    - Average End-to-End Delay: (sum(data_delaySum) / total_data_rx_packets) in milliseconds
    - Total Data Packets Transmitted, Received, Lost
    - Normalized Routing Load (NRL): routing_control_packets / total_data_rx_packets

    Scientific Accuracy Guarantee:
    - Inspects <Ipv4FlowClassifier> and correlates flowId with 5-tuple ports.
    - Excludes AODV control traffic (UDP port 654) from PDR and Delay calculations.
    - Only verified CBR user-data flows (destination ports >= 9, non-654) are counted.
    - If delivered data packets == 0, NRL is returned as None (undefined ratio).
    """
    if not xml_path.exists():
        raise FileNotFoundError(f"FlowMonitor XML output not found at: {xml_path}")

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception as e:
        raise ValueError(f"Failed to parse FlowMonitor XML: {str(e)}")

    # 1. Parse Ipv4FlowClassifier to map flowId -> 5-tuple
    classifiers: Dict[str, Dict[str, Any]] = {}
    for fc in root.findall(".//Ipv4FlowClassifier/Flow"):
        flow_id = fc.attrib.get("flowId")
        if not flow_id:
            continue
        try:
            protocol = int(fc.attrib.get("protocol", -1))
            sport = int(fc.attrib.get("sourcePort", -1))
            dport = int(fc.attrib.get("destinationPort", -1))
            classifiers[flow_id] = {
                "protocol": protocol,
                "sport": sport,
                "dport": dport,
                "src": fc.attrib.get("sourceAddress", ""),
                "dst": fc.attrib.get("destinationAddress", ""),
            }
        except (ValueError, TypeError):
            continue

    total_data_tx_packets = 0
    total_data_rx_packets = 0
    total_data_lost_packets = 0
    total_data_delay_sum_ns = 0.0
    total_data_tx_bytes = 0
    total_data_rx_bytes = 0
    data_flows_count = 0

    # 2. Iterate through FlowStats / Flow and include ONLY verified CBR data flows
    for flow in root.findall(".//FlowStats/Flow"):
        flow_id = flow.attrib.get("flowId")
        if not flow_id or flow_id not in classifiers:
            # Safely skip unclassified flows; never silently count them as user data
            continue

        clf = classifiers[flow_id]

        # Verified CBR data flow: UDP (protocol 17), non-AODV ports, destination port >= 9
        is_cbr_data = (
            clf["protocol"] == 17
            and clf["dport"] != 654
            and clf["sport"] != 654
            and clf["dport"] >= 9
        )
        if not is_cbr_data:
            continue

        tx_pkts = int(flow.attrib.get("txPackets", 0))
        rx_pkts = int(flow.attrib.get("rxPackets", 0))
        lost_pkts = int(flow.attrib.get("lostPackets", 0))

        # NS-3 delaySum format: "123456789ns" or float
        delay_sum_str = flow.attrib.get("delaySum", "0ns")
        if delay_sum_str.endswith("ns"):
            delay_sum_ns = float(delay_sum_str[:-2])
        elif delay_sum_str.endswith("s"):
            delay_sum_ns = float(delay_sum_str[:-1]) * 1e9
        else:
            delay_sum_ns = float(delay_sum_str)

        total_data_tx_packets += tx_pkts
        total_data_rx_packets += rx_pkts
        total_data_lost_packets += lost_pkts
        total_data_delay_sum_ns += delay_sum_ns
        total_data_tx_bytes += int(flow.attrib.get("txBytes", 0))
        total_data_rx_bytes += int(flow.attrib.get("rxBytes", 0))
        data_flows_count += 1

    # 3. Calculate data-only PDR and Delay
    pdr = (total_data_rx_packets / total_data_tx_packets * 100.0) if total_data_tx_packets > 0 else 0.0
    avg_delay_ms: Optional[float] = (
        round(total_data_delay_sum_ns / total_data_rx_packets / 1e6, 2)
        if total_data_rx_packets > 0
        else None
    )

    # 4. Calculate Normalized Routing Load (NRL)
    # NRL = total routing-control packet transmissions / delivered CBR data packets
    # If 0 data packets are delivered, ratio is undefined -> None (explicitly unavailable, no fabricated ratio)
    overhead_ratio: Optional[float] = None
    if routing_control_packets is not None:
        if total_data_rx_packets > 0:
            overhead_ratio = round(routing_control_packets / total_data_rx_packets, 3)
        else:
            overhead_ratio = None

    return {
        "tx_packets": total_data_tx_packets,
        "rx_packets": total_data_rx_packets,
        "lost_packets": total_data_lost_packets,
        "pdr": round(pdr, 2),
        "delay_ms": avg_delay_ms,
        "overhead_ratio": overhead_ratio,
        "tx_bytes": total_data_tx_bytes,
        "rx_bytes": total_data_rx_bytes,
        "data_flows_count": data_flows_count,
        "routing_control_packets": routing_control_packets,
    }


def parse_routing_json(json_path: Path) -> Dict[str, Any]:
    """
    Parses routing packet statistics JSON emitted by NS-3 simulation.
    """
    if not json_path.exists():
        raise FileNotFoundError(f"Routing results JSON not found at: {json_path}")

    try:
        with open(json_path, mode="r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "total_routing_packets": int(data.get("total_routing_packets", 0)),
                "rreq_packets": int(data.get("rreq_packets", 0)),
                "rrep_packets": int(data.get("rrep_packets", 0)),
                "rerr_packets": int(data.get("rerr_packets", 0)),
                "rrep_ack_packets": int(data.get("rrep_ack_packets", 0)),
            }
    except Exception as e:
        if isinstance(e, FileNotFoundError):
            raise
        raise ValueError(f"Failed to parse routing results JSON: {str(e)}")


def parse_routing_from_logs(logs: List[str]) -> Optional[Dict[str, int]]:
    """
    Extracts directly measured routing control metrics from simulation stdout log lines:
    [ROUTING_METRIC] Total=201 RREQ=62 RREP=112 RERR=22 RREP_ACK=5
    """
    pattern = re.compile(
        r"\[ROUTING_METRIC\]\s+Total=(\d+)\s+RREQ=(\d+)\s+RREP=(\d+)\s+RERR=(\d+)\s+RREP_ACK=(\d+)"
    )
    for line in logs:
        match = pattern.search(line)
        if match:
            return {
                "total_routing_packets": int(match.group(1)),
                "rreq_packets": int(match.group(2)),
                "rrep_packets": int(match.group(3)),
                "rerr_packets": int(match.group(4)),
                "rrep_ack_packets": int(match.group(5)),
            }
    return None


def parse_energy_csv(csv_path: Path) -> Dict[str, Any]:
    """
    Parses node energy results CSV generated by the simulation:
    Format: node_id,initial_energy,remaining_energy,consumed_energy,residual_percentage
    """
    if not csv_path.exists():
        raise FileNotFoundError(f"Energy results CSV not found at: {csv_path}")

    total_consumed = 0.0
    total_residual_pct = 0.0
    node_count = 0

    try:
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    consumed = float(row.get("consumed_energy", 0.0))
                    residual_pct = float(row.get("residual_percentage", 100.0))
                    total_consumed += consumed
                    total_residual_pct += residual_pct
                    node_count += 1
                except (ValueError, TypeError):
                    continue

        if node_count > 0:
            return {
                "avg_consumed_energy_j": round(total_consumed / node_count, 3),
                "avg_residual_percent": round(total_residual_pct / node_count, 1),
                "nodes_reported": node_count
            }
        else:
            raise ValueError(f"Energy results CSV contains no valid node energy records: {csv_path}")
    except Exception as e:
        if isinstance(e, (FileNotFoundError, ValueError)):
            raise
        raise ValueError(f"Failed to parse energy results CSV: {str(e)}")
