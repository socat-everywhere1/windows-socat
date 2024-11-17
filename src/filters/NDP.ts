import {
    Icmpv6Packet,
} from "../PacketsStruct";
import PacketUtils from "../PacketUtils";
import DeviceConfiguration from "../DeviceConfiguration";
import Icmpv6Formatter from "../formatters/Icmpv6Formatter";

export default function(data: Buffer, write: (data: Buffer) => void, next: () => void) {
    if (!PacketUtils.isIPv6(data)) {
        return next();
    }

    let packet: Icmpv6Packet = null;

    try {
        packet = Icmpv6Formatter.format(data);
    } catch (error) {
        return next();
    }

    // NDP
    if (packet.icmpv6type !== 135) {
        return next();
    }

    if (PacketUtils.ipv6ToString(packet.sourceIp) !== DeviceConfiguration.LOCAL_IPV6_ADDRESS) {
        return next();
    }

    if (PacketUtils.ipv6ToString(packet.targetAddress) !== DeviceConfiguration.GATEWAY_IPV6_ADDRESS) {
        return next();
    }

    const gatewayMac: Buffer = Buffer.allocUnsafe(6);
    DeviceConfiguration.GATEWAY_MACADDRESS.split(":").forEach((item, index) => {
        gatewayMac[index] = parseInt(`0x${item}`, 16);
    });

    const responsePacket: Icmpv6Packet = { ...packet };
    responsePacket.sourceAddress = gatewayMac;
    responsePacket.destinaltionAddress = packet.options.slice(packet.options.length - 6);
    responsePacket.sourceIp = packet.targetAddress;
    responsePacket.destinationIp = packet.sourceIp;
    responsePacket.icmpv6type = 136;
    responsePacket.reserved = new Buffer([0x06, 0x00, 0x00, 0x00]);
    responsePacket.options = new Buffer([0x02, 0x01, ...gatewayMac]);

    const responseBuffer: Buffer = Icmpv6Formatter.build(responsePacket);

    write(responseBuffer);
}
