#!/usr/bin/env python3
"""
TP-Link Router Client Script
Fetches router status data and outputs JSON to stdout.
Used by the Node.js backend via subprocess.
"""

import argparse
import json
import sys
from datetime import datetime


def get_signal_quality(rsrp: int) -> str:
    """Calculate signal quality from RSRP."""
    if rsrp is None:
        return "unknown"
    if rsrp > -80:
        return "excellent"
    elif rsrp > -90:
        return "good"
    elif rsrp > -100:
        return "fair"
    return "poor"


def get_signal_strength(rsrp: int) -> int:
    """Calculate signal strength percentage from RSRP."""
    if rsrp is None:
        return 0
    # RSRP ranges from -140 (worst) to -44 (best)
    # Map to 0-100%
    if rsrp >= -44:
        return 100
    if rsrp <= -140:
        return 0
    return int((rsrp + 140) / 96 * 100)


def get_display_name(hostname: str, mac: str) -> str:
    """Get display name for device."""
    if hostname and hostname.strip():
        return hostname.strip()
    # Use last 4 chars of MAC
    if mac and len(mac) >= 5:
        return f"Unknown-{mac[-5:].replace(':', '')}"
    return "Unknown"


def get_network_type_name(network_type: int) -> str:
    """Get network type name from code."""
    types = {
        0: "No Service",
        1: "GSM",
        2: "WCDMA",
        3: "4G LTE",
        4: "TD-SCDMA",
        5: "CDMA 1x",
        6: "CDMA 1x Ev-Do",
        7: "4G+ LTE"
    }
    return types.get(network_type, "Unknown")


def get_sim_status_text(status: int) -> str:
    """Get SIM status text from code."""
    statuses = {
        0: "No SIM card detected or SIM card error",
        1: "No SIM card detected",
        2: "SIM card error",
        3: "SIM card prepared",
        4: "SIM locked",
        5: "SIM unlocked",
        6: "PIN locked",
        7: "SIM card is locked permanently",
        8: "Suspension of transmission",
        9: "Unopened"
    }
    return statuses.get(status, "Unknown")


def output_error(error: str, error_code: str, timestamp: int):
    """Output error JSON and exit."""
    print(json.dumps({
        "success": False,
        "error": error,
        "errorCode": error_code,
        "timestamp": timestamp
    }))
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Fetch TP-Link router status")
    parser.add_argument('--host', required=True, help="Router IP address")
    parser.add_argument('--username', default='admin', help="Router username")
    parser.add_argument('--password', required=True, help="Router password")
    parser.add_argument('--https', action='store_true', help="Use HTTPS")
    args = parser.parse_args()

    timestamp = int(datetime.now().timestamp() * 1000)

    # Try to import the library
    try:
        from tplinkrouterc6u import TplinkRouterProvider
    except ImportError:
        output_error(
            "tplinkrouterc6u library not installed. Install with: pip install tplinkrouterc6u",
            "MISSING_DEPENDENCY",
            timestamp
        )

    try:
        # Connect to router
        client = TplinkRouterProvider.get_client(
            host=args.host,
            password=args.password,
            username=args.username,
            logger=None  # Suppress library logging
        )
        client.authorize()

        # Fetch all data
        status = client.get_status()
        firmware = client.get_firmware()

        # Try to get LTE-specific data (may not be available on all routers)
        lte_data = {
            "networkType": 0,
            "networkTypeName": "Unknown",
            "rsrp": None,
            "rsrq": None,
            "snr": None,
            "signalStrength": 0,
            "signalQuality": "unknown"
        }

        sim_data = {
            "status": 0,
            "statusText": "Unknown",
            "isOk": False
        }

        wan_data = {
            "downloadBytesPerSec": 0,
            "uploadBytesPerSec": 0,
            "totalDownloadBytes": 0,
            "totalUploadBytes": 0
        }

        connection_data = {
            "wanIp": "",
            "uptimeSeconds": 0,
            "ispName": ""
        }

        # Try to get LTE status
        try:
            lte_status = client.get_status()
            if hasattr(lte_status, 'wan_ipv4_uptime'):
                connection_data["uptimeSeconds"] = getattr(lte_status, 'wan_ipv4_uptime', 0) or 0
            if hasattr(lte_status, 'wan_ipv4_addr'):
                connection_data["wanIp"] = getattr(lte_status, 'wan_ipv4_addr', '') or ''
        except Exception:
            pass

        # Try LTE-specific methods if available
        try:
            if hasattr(client, 'get_lte_status'):
                lte_info = client.get_lte_status()
                if lte_info:
                    network_type = getattr(lte_info, 'network_type', 0) or 0
                    rsrp = getattr(lte_info, 'rsrp', None)
                    rsrq = getattr(lte_info, 'rsrq', None)
                    snr = getattr(lte_info, 'snr', None) or getattr(lte_info, 'sinr', None)

                    lte_data = {
                        "networkType": network_type,
                        "networkTypeName": get_network_type_name(network_type),
                        "rsrp": rsrp,
                        "rsrq": rsrq,
                        "snr": snr,
                        "signalStrength": get_signal_strength(rsrp),
                        "signalQuality": get_signal_quality(rsrp)
                    }

                    sim_status = getattr(lte_info, 'sim_status', 0) or 0
                    sim_data = {
                        "status": sim_status,
                        "statusText": get_sim_status_text(sim_status),
                        "isOk": sim_status == 5
                    }

                    # Use correct field names: cur_rx_speed, cur_tx_speed, total_statistics
                    total_stats = getattr(lte_info, 'total_statistics', 0) or 0
                    wan_data = {
                        "downloadBytesPerSec": getattr(lte_info, 'cur_rx_speed', 0) or 0,
                        "uploadBytesPerSec": getattr(lte_info, 'cur_tx_speed', 0) or 0,
                        "totalDownloadBytes": total_stats // 2,  # Approximate split
                        "totalUploadBytes": total_stats // 2
                    }

                    connection_data["ispName"] = getattr(lte_info, 'isp_name', '') or ''
        except Exception:
            pass

        # Get IPv4 status for WAN IP if not already set
        try:
            if not connection_data["wanIp"] and hasattr(client, 'get_ipv4_status'):
                ipv4_status = client.get_ipv4_status()
                if ipv4_status:
                    connection_data["wanIp"] = getattr(ipv4_status, 'wan_ipv4_ipaddr', '') or \
                                               getattr(ipv4_status, 'wan_ip', '') or ''
                    if not connection_data["uptimeSeconds"]:
                        connection_data["uptimeSeconds"] = getattr(ipv4_status, 'wan_ipv4_uptime', 0) or 0
        except Exception:
            pass

        # Build devices list
        devices = []
        if hasattr(status, 'devices') and status.devices:
            for d in status.devices:
                is_active = getattr(d, 'active', True)
                if not is_active:
                    continue  # Only include active devices

                mac = getattr(d, 'macaddr', '') or getattr(d, 'mac', '') or ''
                hostname = getattr(d, 'hostname', '') or getattr(d, 'name', '') or ''
                ip = getattr(d, 'ipaddr', '') or getattr(d, 'ip', '') or ''

                # Determine connection type
                conn_type = 'wired'
                if hasattr(d, 'type'):
                    dtype = str(getattr(d, 'type', '')).lower()
                    if '5g' in dtype or '5ghz' in dtype:
                        conn_type = 'wifi_5g'
                    elif '2.4' in dtype or '2g' in dtype or 'wifi' in dtype or 'wireless' in dtype:
                        conn_type = 'wifi_2g'

                devices.append({
                    "macAddress": mac,
                    "ipAddress": ip,
                    "hostname": hostname,
                    "displayName": get_display_name(hostname, mac),
                    "connectionType": conn_type,
                    "signalStrength": getattr(d, 'signal_strength', None) or getattr(d, 'rssi', None),
                    "downloadBytesPerSec": getattr(d, 'down_speed', 0) or 0,
                    "uploadBytesPerSec": getattr(d, 'up_speed', 0) or 0,
                    "isActive": True
                })

        # Count devices
        wired_count = len([d for d in devices if d["connectionType"] == "wired"])
        wifi_count = len([d for d in devices if d["connectionType"].startswith("wifi")])

        # Build response
        result = {
            "success": True,
            "timestamp": timestamp,
            "data": {
                "timestamp": timestamp,
                "lte": lte_data,
                "sim": sim_data,
                "wan": wan_data,
                "devices": devices,
                "deviceCounts": {
                    "total": len(devices),
                    "wired": wired_count,
                    "wifi": wifi_count,
                    "active": len(devices)
                },
                "connection": connection_data,
                "system": {
                    "cpuUsage": getattr(status, 'cpu_usage', 0) or 0,
                    "memoryUsage": getattr(status, 'mem_usage', 0) or 0,
                    "firmwareVersion": getattr(firmware, 'firmware_version', '') or '',
                    "model": getattr(firmware, 'model', '') or getattr(firmware, 'hardware_version', '') or ''
                }
            }
        }

        # Logout
        try:
            client.logout()
        except Exception:
            pass

        print(json.dumps(result))

    except Exception as e:
        error_str = str(e).lower()
        error_code = "CONNECTION_ERROR"

        if "auth" in error_str or "password" in error_str or "unauthorized" in error_str or "403" in error_str:
            error_code = "AUTH_FAILED"
        elif "timeout" in error_str or "timed out" in error_str:
            error_code = "TIMEOUT"
        elif "connection" in error_str or "refused" in error_str or "unreachable" in error_str:
            error_code = "CONNECTION_ERROR"

        output_error(str(e), error_code, timestamp)


if __name__ == '__main__':
    main()
