#!/usr/bin/env python3
# type: ignore
import os
import yaml

from mininet.log import setLogLevel, info
from mininet.node import RemoteController, Controller
from mininet.link import TCLink

from mn_wifi.net import Mininet_wifi
from mn_wifi.node import OVSKernelAP
from mn_wifi.wmediumdConnector import interference
from mn_wifi.link import wmediumd
from mn_wifi.cli import CLI

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
def load_topology():
    with open(os.path.join(SCRIPT_DIR, "topo_config.yaml"), "r") as f:
        return yaml.safe_load(f)
    
def topology():
    
    config = load_topology()
    meta = config.get("meta", {})
    setLogLevel('info')

    if meta:
        info(f"\n*** Topology: {meta.get('title','')} v{meta.get('version','')}\n")
        info(f"*** {meta.get('description','')}\n\n")

    # Create Mininet-WiFi network with OVS access points and wmediumd for wireless interference (stimulate real WiFi conditions)
    net = Mininet_wifi(
        controller=None,
        accessPoint=OVSKernelAP,
        link=wmediumd,
        wmediumd_mode=interference
    )
    topology = config.get("topology", {})
    info("*** Adding controllers (ONOS cluster)\n")
    controller_configs = topology.get("controllers", [])
    controllers = []
    for c in controller_configs:
        # Default RemoteController for Docker-based ONOS controller, other ONOS created controllers can be added with custom IP/port if needed.
        if c.get("type", "RemoteController") == "RemoteController":
            controllers.append(
                net.addController(
                    c["name"],
                    controller=RemoteController,
                    ip=c["ip"],
                    port=int(c["port"]),
            )
        )
        else:
            controllers.append(
                net.addController(
                    c["name"],
                    controller=Controller,
                    ip =c["ip"],
                    port=int(c["port"]),
                )
            )
        
    info("*** Adding stations\n")
    station_configs = topology.get("stations", [])
    stations = {} # wireless end hosts connect to APs
    for sta in station_configs:
        stations[sta["name"]] = net.addStation(
            sta["name"],
            ip=sta["ip"],
                range=sta.get("range", 20),
            ssid=sta.get("ssid"), # Set SSID for station to enable allowed association with APs
            )

    info("*** Adding access points (OVS)\n")
    ap_configs = topology.get("accessPoints", [])
    aps = {}
    for ap in ap_configs:
        aps[ap["name"]] = net.addAccessPoint(
            ap["name"],
            ssid=ap["ssid"],
                mode=ap.get("mode", "g"),
                channel=ap.get("channel", 1),
                protocols=ap.get("protocols", "OpenFlow13"),
                failMode=ap.get("failMode", "secure"), # prevent AP from flooding packets when not connected to ONOS controller.
        )
        
    info("*** Propagation + configure wifi nodes\n")
    prop = topology.get("propagation", {})
    net.setPropagationModel(model=prop.get("model", "logDistance"), exp=float(prop.get("exp", 4.0)))
    net.configureWifiNodes()

    # Set station positions after wifi configuration
    info("*** Setting positions\n")
    for sta in station_configs:
        stations[sta["name"]].setPosition(sta["position"])
    for ap in ap_configs:
        aps[ap["name"]].setPosition(ap["position"])
            
        
    info("*** Starting network\n")
    net.build()
    for c in controllers:
        c.start()

    # Start APs with their respective controllers to enable clustering functionality.
    for ap_cfg in ap_configs:
        ap_obj = aps[ap_cfg["name"]]
        ctrl_name = ap_cfg.get("controller")

        if not ctrl_name:
            raise ValueError(f"AP {ap_cfg['name']} missing 'controller' in YAML")

        if ctrl_name not in [c["name"] for c in controller_configs]:
            raise ValueError(f"AP {ap_cfg['name']} references unknown controller '{ctrl_name}'")

        ap_obj.start([c for c in controllers if c.name == ctrl_name])
        
        ap_obj.cmd(f"ovs-vsctl set-fail-mode {ap_obj.name} {ap_cfg.get('failMode', 'secure')}")
        ap_obj.cmd(f"ovs-ofctl -O OpenFlow13 del-flows {ap_obj.name}")
                  
    info("*** Running CLI\n")
    CLI(net)
    net.stop()


if __name__ == '__main__':
    topology()