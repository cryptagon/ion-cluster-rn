/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React, { useEffect, useState, createContext } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  Button,
} from 'react-native';

import {
  Header,
  LearnMoreLinks,
  Colors,
  DebugInstructions,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { FlatGrid } from 'react-native-super-grid';

console.log('registering globals')
registerGlobals()
console.log('globals: ', global)

const {Client, RemoteStream, LocalStream} = require('ion-sdk-js')
// import {Client, RemoteStream} from 'ion-sdk-js'
import {IonSFUJSONRPCSignal} from 'ion-sdk-js/lib/signal/json-rpc-impl'



const HOST = "wss://sfu.dogfood.tandem.chat"
// const HOST = 'ws://localhost:7000'
const SESSION_ID = "20ff6701-0b20-4167-84d3-4d9ef00e1a9f"
const TOKEN = "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJyaWQiOiIyMGZmNjcwMS0wYjIwLTQxNjctODRkMy00ZDllZjAwZTFhOWYiLCJzaWQiOiIyMGZmNjcwMS0wYjIwLTQxNjctODRkMy00ZDllZjAwZTFhOWYifQ.jAp49x3QYHkLJu4HhH7IEnQJrzFCbw8nWEz-j-hJcXFH7Drn2skpH0EY3uhBOLgi7Es5kNFdg31xSeLRroe8nw"

const ENDPOINT = `${HOST}/session/${SESSION_ID}?access_token=${TOKEN}`

class OfferDebugSignal extends IonSFUJSONRPCSignal {
  async offer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    offer.sdp = offer.sdp.replace('640c34', '42e034')
    offer.sdp = offer.sdp.replace('640c1f', '42e034')
    // console.log('offer: ', offer.sdp)
    const r = await super.offer(offer)
    // console.log('response: ', r.sdp)
    return r
  }


  async answer(answer: RTCSessionDescriptionInit): void {
    console.log('inbound negotiation', answer.sdp)
    answer.sdp = answer.sdp.replace('640c34', '42e034')
    answer.sdp = answer.sdp.replace('640c1f', '42e034') 
    await super.answer(answer)
  }

}


type ClientProps = {
  sessionID: string
}


const IonClient = (props: ClientProps) => {
  const [state, setState] = useState('connecting')

  const [localStream, setLocal] = useState<null | MediaStream>(null)
  const [streams, setStreams] = useState<MediaStream[]>([])

  useEffect(() => {
    const signal = new OfferDebugSignal(ENDPOINT)
    const client = new Client(signal, {codec: 'h264', sdpSemantics: 'unified-plan'})
    // client.onspeaker = (s) => {console.log('active speakers: ', s)}

    console.log('built signal: ', signal)
    console.log('build client: ', client)
    signal.onopen = async () => {
      console.log('connecting')
      setState('connecting')
      await client.join(SESSION_ID)
      console.log('connected')
      setState('connected')
      publishLocal()
    }

    const publishLocal = async () => {
      const local = await LocalStream.getUserMedia({
        audio: true,
        video: true,
        simulcast: false, // enable simulcast
      });
    
      client.publish(local)
      setLocal(local)

      client.transports[1].pc.onaddstream = (e:any) => {
        console.log('on add stream: ', e.stream)
        if(e && e.stream.getVideoTracks().length > 0) setStreams(streams => [...streams, e.stream])
      }

      client.transports[1].pc.onremovestream = (e:any) => {
        console.log('on remove stream', e.stream)
        setStreams(streams => streams.filter(s => s.id != e.stream.id))
      }
    }
    
    return () => {
      client.transports[1].pc.onremovestream = null
      client.transports[1].pc.onaddstream  = null
      signal.close()
      client.close()
    }
  }, [])


  const [rearCamera, setRearCamera] = useState(false)
  const switchCameras = () => {
    const track = localStream?.getVideoTracks()[0]
    console.log("switching track: ", track )
    track._switchCamera()
    setRearCamera(!rearCamera)
  }

  const [speaker, setSpeaker] = useState(false)
  const switchSpeaker = () => {
    InCallManager.setSpeakerphoneOn(!speaker)
    setSpeaker(!speaker)
  }

  console.log('streams: ', streams)
  return (
    <View>
      <Text>state: {state}</Text>
      <View>
      { localStream && (
        <View style={{flexDirection:'row'}}>
          <RTCView streamURL={localStream.toURL()} style={styles.video} />
          <View style={styles.panel}>
            <Button title={ rearCamera? "Front Camera" : "Rear Camera"} onPress={switchCameras}/> 
            <Button title={ speaker ? "Headset": "Speakerphone"  } onPress={switchSpeaker}/>
        </View>

        </View> 
        )
      }
      <Text>VIDEOS:</Text>
      {/* {streams.map(s => 
        ( 
          <View>
            <Text>{s.id}</Text>
            <RTCView streamURL={s.toURL()} style={styles.video}/>
          </View>
        )
      )} */}
  
      <FlatGrid
        itemDimension={240}
        data={streams}
        spacing={2}
        renderItem={({ item }) => (<RTCView streamURL={item.toURL()} style={styles.video}/>)}
      />
      </View>
   </View>
  )
}


declare const global: {HermesInternal: null | {}};

const App = () => {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView>
        {/* <ScrollView */}
          {/* contentInsetAdjustmentBehavior="automatic" */}
          {/* style={styles.scrollView}> */}
          <Text style={styles.sectionTitle}>IonCluster</Text>
          <View style={styles.body}>
            <IonClient sessionID="test-session" />
          </View>
        {/* </ScrollView> */}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  video: {
    flex: 3,
    width: 240,
    height: 240,
  },
  panel: {
    flex:2,
    paddingRight:24,
    paddingTop: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
});

export default App;
