#!/bin/bash
# Run Mininet-WiFi Medical IoT topology in Docker
# Usage: ./run_mininet_docker.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build mininet image if not already done
if ! docker image inspect mininet-wifi:latest > /dev/null 2>&1; then
    echo "Building Docker image for Mininet-WiFi..."
    docker build -t mininet-wifi -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
fi

    
# Clean up any leftover mininet state on host
echo "Cleaning up previous Mininet state..."
sudo mn -c 2>/dev/null || true

# Load mac80211_hwsim on HOST before running Docker
echo "Loading mac80211_hwsim kernel module on host..."
sudo modprobe -r mac80211_hwsim 2>/dev/null
sudo modprobe mac80211_hwsim radios=4
sleep 2

# Run Docker with access to host network and kernel modules
docker run -it --rm \
    --privileged \
    --name mininet-wifi \
    --network host \
    -v /lib/modules:/lib/modules:ro \
    -v /sys:/sys:ro \
    -v "$SCRIPT_DIR:/app/code" \
    mininet-wifi \
    bash -c "
        echo 'Starting Open vSwitch...';
        service openvswitch-switch start;
        sleep 2;

        echo 'Checking PyYAML...';

        if python3 -c \"import yaml\" > /dev/null 2>&1; then
            echo 'PyYAML already installed';
        else
            echo 'Installing PyYAML...';
            pip3 install pyyaml;
        fi;

        echo 'Cleaning Mininet inside container...';
        mn -c 2>/dev/null;

        echo 'Running topology...';
        python3 /app/code/net_topo.py
    "