// tslint:disable-next-line:no-var-requires
const native = require("../index.js");


import * as fs from "fs";
import * as dns from "dns";
import Config from "./Config";
import * as path from "path";
import { promisify } from "util";
import * as iconv from "iconv-lite";
import TAPControl from "./TAPControl";
import PacketUtils from "./PacketUtils";
import * as cprocess from "child_process";
import * as NativeTypes from "./NativeTypes";
import DeviceConfiguration from "./DeviceConfiguration";

// tslint:disable-next-line:no-var-requires
const optimist = require("optimist")
    .usage("Usage: $0 --host [shadowsocks host] --port [shadowsocks port] --passwd [shadowsocks password] --xtudp [x times udp packets]")
    .default("host", undefined)
    .default("port", undefined)
    .default("passwd", undefined)
    .default("method", undefined)
    .default("tcphost", undefined)
    .default("tcpport", undefined)
    .default("tcppasswd", undefined)
    .default("tcpmethod", undefined)
    .default("udphost", undefined)
    .default("udpport", undefined)
    .default("udppasswd", undefined)
    .default("udpmethod", undefined)
    .default("ipouhost", undefined)
    .default("ipouport", undefined)
    .default("xtudp", 1)
    .default("ip", "10.0.1.2")
    .default("gateway", "10.0.1.1")
    .default("dns", "1.1.1.1")
    .default("v6dns", "2606:4700:4700::1111")
    .default("skipdns", "false")
    .default("disablev6", "false")
    .default("skipss","true")
    .default("ipou","true")
    .default("routes", "0.0.0.0/0")
    .default("dadaptername","tun3")
    .default("dlocallistenport",undefined)
    .default("dlocallistenip","127.0.0.1")
    .default("dremotenode","N2")
    .default("doutbind",undefined)
    .default("dlocalnode","N3")
    .default("skiptun", "false")
    ;

const argv = optimist.argv;

async function main() {

    if (argv.h !== undefined || argv.help !== undefined) {
        console.log(optimist.help());
        process.exit(-1);
    }

    {
        DeviceConfiguration.LOCAL_IP_ADDRESS=argv.ip;
        DeviceConfiguration.GATEWAY_IP_ADDRESS=argv.gateway;

        let allHost: string = argv.host;
        let tcpHost: string = argv.tcphost;
        let udpHost: string = argv.udphost;

        if (tcpHost === undefined) {
            tcpHost = allHost;
        } 

        if (udpHost === undefined) {
            udpHost = allHost;
        } 
        
        Config.set("ShadowsocksTcpHost", tcpHost);
        argv.tcpport === undefined ? Config.set("ShadowsocksTcpPort", argv.port) : Config.set("ShadowsocksTcpPort", argv.tcpport);
        argv.tcppasswd === undefined ? Config.set("ShadowsocksTcpPasswd", argv.passwd) : Config.set("ShadowsocksTcpPasswd", argv.tcppasswd);
        argv.tcpmethod === undefined ? Config.set("ShadowsocksTcpMethod", argv.method) : Config.set("ShadowsocksTcpMethod", argv.tcpmethod);

        Config.set("ShadowsocksUdpHost", udpHost);
        argv.udpport === undefined ? Config.set("ShadowsocksUdpPort", argv.port) : Config.set("ShadowsocksUdpPort", argv.udpport);
        argv.udppasswd === undefined ? Config.set("ShadowsocksUdpPasswd", argv.passwd) : Config.set("ShadowsocksUdpPasswd", argv.udppasswd);
        argv.udpmethod === undefined ? Config.set("ShadowsocksUdpMethod", argv.method) : Config.set("ShadowsocksUdpMethod", argv.udpmethod);
        argv.ipouport === undefined ? Config.set("IPoUPort", argv.tcpport): Config.set("IPoUPort", argv.ipouport)  ;
        argv.ipouhost === undefined ? Config.set("IPoUHost", argv.tcphost): Config.set("IPoUHost", argv.ipouhost)  ;
        
        Config.set("skipss", (argv.skipss.toLocaleLowerCase() === "true"));
        if (Config.get("skipss")){
        }else{
            if (Config.get("ShadowsocksTcpHost") === undefined ||
                Config.get("ShadowsocksUdpHost") === undefined ||
                Config.get("ShadowsocksTcpMethod") === undefined ||
                Config.get("ShadowsocksUdpMethod") === undefined ||
                Config.get("ShadowsocksTcpPasswd") === undefined ||
                Config.get("ShadowsocksUdpPasswd") === undefined) {
                console.log(optimist.help());
                process.exit(-1);
            }
        }
        Config.set("DNS", argv.dns);
        Config.set("SkipDNS", (argv.skipdns.toLocaleLowerCase() === "true"));
        Config.set("SkipTUN", (argv.skiptun.toLocaleLowerCase() === "true"));
        Config.set("ipou", (argv.ipou.toLocaleLowerCase() === "true"));
        if (Config.get("ipou")){
            if (Config.get("IPoUPort") === undefined ||
                Config.get("IPoUHost") === undefined ) {
                console.log(optimist.help());
                process.exit(-1);
            }
        }

        Config.set("XTUdp", parseInt(argv.xtudp, 10));

        if (isNaN(Config.get("XTUdp"))) {
            console.log("!!!!!!!!!!! ERROR XTUdp is not TESTED!!!!!!!!!!");
            Config.set("XTUdp", 1);
        }
    }

 
    if (argv.debug) {
        console.log(Config.get());
        process.exit(-1);
    }


    if (Config.get("SkipTUN")){
        console.log("Skip tun init.");
    }
    else{

        /* 设置OpenVPN网卡 */
        if (!TAPControl.checkAdapterIsInstalled()) {
            console.log("Installing driver...");
            const result = TAPControl.installAdapter(path.join(process.cwd(), "driver/tapinstall.exe"));
            if (result !== 0) {
                console.error(`Driver was not successfully installed. Exit code: ${result}.`);
                if (result === 2) {
                    console.log(`Please run as administrator.`);
                }
                process.exit(-1);
            }
            console.log("Install driver successfully.");
        }
        const tapControl: TAPControl = TAPControl.init(DeviceConfiguration.GATEWAY_IP_ADDRESS);
        const tapInfo = tapControl.getAdapterInfo();
        tapControl.enable();
        console.log(tapInfo)

        /* 获取默认网卡 */
        const allDevicesInfo: Array<NativeTypes.DeviceInfo> = native.N_GetAllDevicesInfo() as Array<NativeTypes.DeviceInfo>;
        const allIpforwardEntry: Array<NativeTypes.IpforwardEntry>=native.N_GetIpforwardEntry() as Array<NativeTypes.IpforwardEntry>;
        const defaultGateway: string = allIpforwardEntry[0].nextHop;
        let defaultDevice: NativeTypes.DeviceInfo = null;
        for (const device of allDevicesInfo) {
            //console.log(device);
            if (device.gatewayIpAddress === defaultGateway) {
                defaultDevice = device;
            }
        }
        /*
        for (const thisIpforwardEntry of allIpforwardEntry) {
            console.log(thisIpforwardEntry);
        }*/
        if (defaultDevice == null) {
            console.log("!!!!ERROR: CAN NOT FIND DEFAULT ROUTE!!!!!");
            Config.set("DefaultIp", "192.168.1.1");
            Config.set("DefaultGateway", "192.168.1.1");
        }else{
            Config.set("DefaultIp", defaultDevice.currentIpAddress);
            Config.set("DefaultGateway", defaultDevice.gatewayIpAddress);
        
        }
        console.log("DefaultIp "+Config.get("DefaultIp"));
        console.log("DefaultGateway "+Config.get("DefaultGateway"));
    
        /* 清理上次运行所留下的路由表 */
        {
            const routes = (native.N_GetIpforwardEntry() as Array<NativeTypes.IpforwardEntry>);
            for (const route of routes) {
                if (route.interfaceIndex !== tapInfo.index) {
                    continue;
                }
                const code = native.N_DeleteIpforwardEntry({
                    dwForwardDest: route.destIp,
                    dwForwardMask: route.netMask,
                    dwForwardPolicy: route.proto,
                    dwForwardNextHop: route.nextHop,
                    dwForwardIfIndex: route.interfaceIndex,
                    dwForwardType: route.type,
                    dwForwardAge: route.age,
                    dwForwardMetric1: route.metric1,
                });
                if (code !== 0) {
                    console.log(`Route deletion failed. Code: ${code}. Route: ${route.destIp}/${route.netMask}`);
                }
            }
        }
    
        /* 设置路由表 */
        {
   
            const initCommands: Array<Array<string>> = [
                ["netsh", "interface", "ipv4", "set", "interface", `${tapInfo.index}`, "metric=1"], //set default
                ["netsh", "interface", "ipv4", "set", "dnsservers", `${tapInfo.index}`, "static", Config.get("DNS"), "primary"],
                ["netsh", "interface", "ip", "set", "address", `name=${tapInfo.index}`, "static",
                    DeviceConfiguration.LOCAL_IP_ADDRESS, DeviceConfiguration.LOCAL_NETMASK, DeviceConfiguration.GATEWAY_IP_ADDRESS],
                //["route", "delete", "0.0.0.0", DeviceConfiguration.GATEWAY_IP_ADDRESS], // if you dont want default
                ["route", "add", Config.get("ShadowsocksTcpHost"), "mask", "255.255.255.255", defaultGateway, "metric", "1"],//set bypass
                ["route", "add", Config.get("ShadowsocksUdpHost"), "mask", "255.255.255.255", defaultGateway, "metric", "1"],//set bypass
            ];
    
            if (Config.get("SkipDNS")) {
                initCommands.push(
                    ["route", "add", Config.get("DNS"), "mask", "255.255.255.255", defaultGateway, "metric", "1"], //set bypass
                    ["netsh", "interface", "ipv4", "set", "dnsservers", `${tapInfo.index}`, "static", DeviceConfiguration.GATEWAY_IP_ADDRESS, "primary"],
                    ["netsh", "interface", "ipv6", "set", "dnsserver", `name=${tapInfo.index}`, "source=static", `address=""`, "validate=no"],
                );
            }else{
                /*initCommands.push(
                    ["route", "delete", Config.get("DNS")], // if you dont want dns
                );*/
            }
    
            if (argv.disablev6 === "true") {
                console.log("IPv6 has been disabled.");
                initCommands.push(
                    ["netsh", "int", "ipv6", "delete", "route", "::/0", `interface=${tapInfo.index}`, `nexthop=${DeviceConfiguration.GATEWAY_IPV6_ADDRESS}`],
                    ["netsh", "int", "ipv6", "delete", "address", `interface=${tapInfo.index}`, `address=${DeviceConfiguration.LOCAL_IPV6_ADDRESS}`],
                );
            } else {
                initCommands.push(
                    ["netsh", "interface", "ipv6", "set", "interface", `${tapInfo.index}`, "metric=1"],
                    ["netsh", "interface", "ipv6", "set", "address", `interface=${tapInfo.index}`, `address=${DeviceConfiguration.LOCAL_IPV6_ADDRESS}`],
                    ["netsh", "interface", "ipv6", "add", "route", "::/0", `interface=${tapInfo.index}`, `nexthop=${DeviceConfiguration.GATEWAY_IPV6_ADDRESS}`],
                    ["netsh", "interface", "ipv6", "set", "dnsserver", `name=${tapInfo.index}`, "source=static", `address=${argv.v6dns}`, "validate=no"],
                );
            }
    
            initCommands.forEach((command) => {
                process.stdout.write(command.join(" ") + " ");
                const result = cprocess.spawnSync(command[0], command.slice(1), { timeout: 1000 * 5 });
                const errorMessage: string = iconv.decode(result.stderr, "cp936").toString().trim();
                if (errorMessage.length !== 0) {
                    process.stderr.write(errorMessage);
                }
                process.stdout.write("\n");
            });
        }
    
        // 添加自定义路由表
        {
            const routes: Array<Array<string | number>> = [];
    
            let cidrList: Array<string> = [];
    
            if (fs.existsSync(argv.routes)) {
                const rawData = fs.readFileSync(argv.routes).toString();
                cidrList = rawData.split("\n");
            } else {
                cidrList = argv.routes.split(",");
            }
    
            for (let cidr of cidrList) {
                cidr = cidr.trim();
                const [ip, range] = cidr.split("/");
                const netmask: string = PacketUtils.calculatenIpv4NetMask(parseInt(range, 10));
                routes.push([ip, netmask]);
            }
    
            for (const route of routes) {
                const [ip, netmask] = route;
                const code: number = native.N_CreateIpforwardEntry({
                    dwForwardDest: ip,
                    dwForwardMask: netmask,
                    dwForwardPolicy: 0,
                    dwForwardNextHop: DeviceConfiguration.GATEWAY_IP_ADDRESS,
                    dwForwardIfIndex: tapInfo.index,
                    dwForwardType: NativeTypes.IpforwardEntryType.MIB_IPROUTE_TYPE_INDIRECT,
                    dwForwardProto: NativeTypes.IpforwardEntryProto.MIB_IPPROTO_NETMGMT,
                    dwForwardAge: 0,
                    dwForwardNextHopAS: 0,
                    dwForwardMetric1: 2,
                });
                if (code !== 0) {
                    console.log(`Route addition failed. Code: ${code}. Route: ${ip}/${netmask}`);
                }
    
            }
        }
        
        // tslint:disable-next-line:ban-types
        const filters: Array<Function> = [];
        if (Config.get("skipss")){
            console.log("skipping default ss: TCP, DNS, UDP are all skipped!")
        }else{
            console.log("using default ss")
            filters.push(require("./filters/TCP").default);
            if (Config.get("SkipDNS")) {
                filters.push(require("./filters/DNS").default);
            }
            filters.push(require("./filters/UDP").default);
        }
        filters.push(require("./filters/ARP").default);
        //filters.push(require("./filters/TimesUDP").default);
        if (Config.get("ipou")){
            console.log("using ipou ")
            filters.push(require("./filters/IP").default);
        }else{
            console.log("using ndp ")
            filters.push(require("./filters/NDP").default);
        }
        async function loop() {
            let data: Buffer = null;
            try {
                data = await tapControl.read() as Buffer;
            } catch (error) {
                console.error("Failed to get data from adapter.", error);
                return setImmediate(loop);
            }

            let index: number = 0;
            function next() {
                const func = filters[index++];
                if (func === undefined) {
                    return;
                }
                // tslint:disable-next-line:no-shadowed-variable
                func(data, (data) => tapControl.write(data), next);
            }
            next();
            return setImmediate(loop);
        }
        loop();
    }
}

process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
});

main();
