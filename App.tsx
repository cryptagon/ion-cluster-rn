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

import Lightbox from 'react-native-lightbox';

import RNCallKeep from 'react-native-callkeep';

const callKeepOptions = {
  ios: {
    appName: 'IonCluster',
  },
  android: {
    alertTitle: 'Permissions required',
  //   alertDescription: 'This application needs to access your phone accounts',
  //   cancelButton: 'Cancel',
  //   okButton: 'ok',
  //   imageName: 'phone_account_icon',
  //   additionalPermissions: [PermissionsAndroid.PERMISSIONS.example],
  //   // Required to get audio in background when using Android 11
  //   foregroundService: {
  //     channelId: 'com.company.my',
  //     channelName: 'Foreground service for my app',
  //     notificationTitle: 'My app is running on background',
  //     notificationIcon: 'Path to the resource icon of the notification',
  //   }, 
  }
};


console.log('registering globals')
registerGlobals()
console.log('globals: ', global)

const {Client, RemoteStream, LocalStream} = require('ion-sdk-js')
// import {Client, RemoteStream} from 'ion-sdk-js'
import {IonSFUJSONRPCSignal} from 'ion-sdk-js/lib/signal/json-rpc-impl'

const webrtcConfig = {
  codec: 'h264', 
  sdpSemantics: 'unified-plan',
  iceServers: [
    {'urls': 'stun:stun.l.google.com:19302'},
  ],
}

const HOST = "wss://sfu.dogfood.tandem.chat"
// const HOST = 'ws://localhost:7000'
const SESSION_ID = "5aa8b3eb-c8e4-4bec-9f0a-f9d2d364972f"
const TOKEN ="eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJyaWQiOiI1YWE4YjNlYi1jOGU0LTRiZWMtOWYwYS1mOWQyZDM2NDk3MmYiLCJzaWQiOiI1YWE4YjNlYi1jOGU0LTRiZWMtOWYwYS1mOWQyZDM2NDk3MmYifQ.8xOZAROCZg2Lw6eh8wjdhQ_l0fQ7tCUtO3PQo-ZY1K5SSk-SbZ-tUNZzQIcWPcegn5oUR80UeflQbHYac9rSyw"

const ENDPOINT = `${HOST}/session/${SESSION_ID}?access_token=${TOKEN}`

class OfferDebugSignal extends IonSFUJSONRPCSignal {
  async offer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    offer.sdp = offer.sdp.split('640c34').join('42e034')
    offer.sdp = offer.sdp.split('640c1f').join('42e034')
    // console.log('offer: ', offer.sdp)
    const r = await super.offer(offer)
    // console.log('response: ', r.sdp)
    return r
  }


  async answer(answer: RTCSessionDescriptionInit): void {
    console.log('inbound negotiation', answer.sdp)
    answer.sdp = answer.sdp.split('640c34').join('42e034')
    answer.sdp = answer.sdp.split('640c1f').join('42e034') 
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
    const client = new Client(signal, webrtcConfig) 
    // client.onspeaker = (s) => {console.log('active speakers: ', s)}

    console.log('built signal: ', signal)
    console.log('build client: ', client)
    signal.onopen = async () => {
      console.log('connecting')
      setState('connecting')
      await client.join(SESSION_ID)
      console.log('connected')
      setState('connected')
      await publishLocal()
      
      RNCallKeep.addEventListener('didLoadWithEvents', async(events) => {
        // `events` is passed as an Array chronologically, handle or ignore events based on the app's logic
        // see example usage in https://github.com/react-native-webrtc/react-native-callkeep/pull/169 or https://github.com/react-native-webrtc/react-native-callkeep/pull/205
      });
      await RNCallKeep.setup(callKeepOptions)
      RNCallKeep.startCall(SESSION_ID, "IonCluster", "Meeting", "generic", true)
      RNCallKeep.setCurrentCallActive(SESSION_ID); 
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
        itemDimension={200}
        data={streams}
        spacing={2}
        renderItem={
          ({ item }) => (
            <Lightbox swipeToDismiss={false}>
                <ScrollView
                  minimumZoomScale={1}
                  maximumZoomScale={4}
                  centerContent={true}
                >
                  <RTCView streamURL={item.toURL()} style={styles.video}/>
                </ScrollView>
            </Lightbox>
          )
        }
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
    paddingRight: 8,
    paddingLeft: 8,
    height: 200,
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
