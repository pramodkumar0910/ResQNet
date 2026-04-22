// Initialize Lucide Icons
lucide.createIcons();

document.addEventListener('DOMContentLoaded', () => {
  let markers = {};

  // Map is now initialized in index.html for maximum visibility
  let map = window.leafletMap;

  // --- 1. Tab Navigation Routing ---
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Remove active from all nav and screens
      navItems.forEach(nav => nav.classList.remove('active'));
      screens.forEach(screen => screen.classList.remove('active'));

      // Add active to clicked nav and target screen
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');

      // Re-trigger slide animation
      const targetScreen = document.getElementById(targetId);
      targetScreen.classList.remove('animate-slide');
      void targetScreen.offsetWidth; // Trigger reflow
      targetScreen.classList.add('animate-slide');

      // Cascading stagger effect for grid items
      const animatableItems = targetScreen.querySelectorAll('.feed-card, .stat-card, .type-btn, .map-marker');
      animatableItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.08}s`;
        item.classList.remove('animate-slide');
        void item.offsetWidth;
        item.classList.add('animate-slide');
      });

      // Fix for Leaflet: Invalidate size when map screen becomes active
      if (targetId === 'map-view') {
        const currentMap = map || window.leafletMap;
        if (currentMap) {
          setTimeout(() => {
            currentMap.invalidateSize();
          }, 100);
        }
      }
    });
  });


  // --- 2. Guest App Interactivity ---
  const sosBtn = document.getElementById('sos-trigger');
  const sosHint = document.getElementById('sos-hint');
  const activeStatus = document.getElementById('active-status');
  const typeBtns = document.querySelectorAll('.type-btn');
  
  let pressTimeout;

  // SOS Button Long Press Simulation
  sosBtn.addEventListener('mousedown', () => {
    sosHint.innerText = 'Keep holding...';
    sosHint.style.color = 'var(--accent-red)';
    
    pressTimeout = setTimeout(() => {
      triggerEmergency();
    }, 1500); // 1.5s for demo
  });

  // --- Firestore Data Push ---
  const sendSOS = async () => {
    try {
      const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
      
      const payload = {
        type: "manual",
        status: "active",
        source: "button",
        timestamp: new Date()
      };

      // Get location before sending
      navigator.geolocation.getCurrentPosition(async (position) => {
        payload.location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        const docRef = await addDoc(collection(window.db, "emergencies"), payload);
        console.log("Emergency Sent with Location 🚨");
        assignEmergency("Fire Team", docRef.id);
      }, async (error) => {
        console.warn("Location error:", error);
        const docRef = await addDoc(collection(window.db, "emergencies"), payload);
        console.log("Emergency Sent without Location 🚨");
        assignEmergency("Fire Team", docRef.id);
      });

    } catch (error) {
      console.error("Firestore Error:", error);
    }
  };

  async function assignEmergency(team, id = null, btn = null) {
    // 1. Immediate UI Feedback
    if (btn) {
      btn.innerText = "Assigned";
      btn.style.background = "rgba(255, 255, 255, 0.2)";
      btn.style.color = "white";
      btn.style.cursor = "default";
      btn.disabled = true;

      // Also update the responder tag if present in the same card
      const card = btn.closest('.glass');
      if (card) {
        const tag = card.querySelector('.responder-tag');
        if (tag) {
          tag.innerText = team;
          tag.classList.add('active');
        }
      }
    }

    // 2. Browser Notification (User's Code)
    if (Notification.permission === "granted") {
      new Notification("🚨 Emergency Alert", {
        body: `Emergency in Kitchen Area. Responder ${team} assigned!`,
      });
    } else if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        new Notification("🚨 Emergency Alert", {
          body: `Emergency in Kitchen Area. Responder ${team} assigned!`,
        });
      }
    }

    // 2. Firestore Update
    if (id && window.db) {
       const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
       try {
          await updateDoc(doc(window.db, "emergencies", id), {
             status: "assigned",
             assignedResponder: team,
             assignedAt: new Date()
          });
         console.log(`Emergency ${id} assigned to ${team}.`);
       } catch (e) {
         console.error("Assignment error:", e);
       }
    } else {
       console.warn("Assignment mock: No ID provided for database update.");
    }
  }

  window.assignEmergency = assignEmergency;
  window.assignEmergencyWithId = assignEmergency; // Alias for cleaner dynamic calling

  // Add direct click listener to SOS button
  sosBtn.addEventListener("click", (e) => {
    sendSOS("manual", "button-click");
  });

  // --- Firestore Real-time Listener ---
  const initFirestoreListener = async () => {
    try {
      if(!window.db) return;
      const { collection, onSnapshot, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js");
      
      window.resolveEmergency = async (id) => {
        try {
          await updateDoc(doc(window.db, "emergencies", id), {
            status: "resolved"
          });
          console.log(`Emergency ${id} resolved.`);
        } catch (error) {
          console.error("Error resolving emergency:", error);
        }
      };

      
      const list = document.getElementById("emergency-list");

      let isFirstSnapshot = true;
      onSnapshot(collection(window.db, "emergencies"), (snapshot) => {
        if(list) list.innerHTML = "";
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const id = docSnap.id;
          
          // --- Update Text List ---
          // Filter: only show incidents that are neither resolved nor assigned
          if (data.status === 'active') {
              const item = document.createElement("div");
              item.className = data.type === "fire" ? "critical" : "normal";
              item.style.background = "rgba(15, 23, 42, 0.8)";
              item.style.borderLeft = "6px solid var(--accent-red)";
              item.style.color = "white";
              item.style.padding = "15px";
              item.style.margin = "10px 0";
              item.style.borderRadius = "12px";
              item.style.display = "flex";
              item.style.justifyContent = "space-between";
              item.style.alignItems = "center";
              item.style.backdropFilter = "blur(10px)";
              
              item.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px;">
                  <span style="font-weight:800; text-transform:uppercase; letter-spacing:1px;">🚨 ${data.type}</span>
                  <span style="font-size:0.75rem; color:var(--text-muted);">Source: ${data.source}</span>
                </div>
                <div style="display:flex; gap:8px;">
                  <button onclick="assignEmergency('Emergency-Team', '${id}', this)" style="background:var(--accent-cyan); color:#000; padding:6px 12px; border-radius:8px; font-weight:bold; font-size:0.8rem; cursor:pointer; border:none;">Assign</button>
                  <button onclick="resolveEmergency('${id}')" style="background:white; color:red; padding:6px 12px; border-radius:8px; font-weight:bold; font-size:0.8rem; cursor:pointer; border:none;">Resolve</button>
                </div>
              `;
              if(list) list.appendChild(item);
          }

          // --- Update Map Markers ---
          const currentMap = map || window.leafletMap;
          if (currentMap && data.location && data.status !== 'resolved') {
            const pos = [data.location.lat, data.location.lng];
            
            if (markers[id]) {
                markers[id].setLatLng(pos);
            } else {
                const markerColor = data.type === 'fire' ? '#ff0000' : '#ffa500';
                const marker = L.circleMarker(pos, {
                  radius: 12,
                  fillColor: markerColor,
                  color: "#fff",
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.8
                }).addTo(currentMap);

                marker.bindPopup(`
                  <div style="color:#000; font-family: 'Outfit', sans-serif;">
                    <strong style="text-transform: capitalize;">${data.type} Emergency</strong><br>
                    <span style="font-size:0.8rem; color:#666;">Status: ${data.status}</span><br>
                    <span style="font-size:0.8rem; color:#666;">Source: ${data.source}</span>
                  </div>
                `);

                markers[id] = marker;
            }
          } else if (markers[id] && data.status === 'resolved') {
            // Remove marker if resolved
            if (currentMap) currentMap.removeLayer(markers[id]);
            delete markers[id];
          }
        });

        // Play audio only when a NEW document is added after the first load
        if (!isFirstSnapshot) {
          const hasNew = snapshot.docChanges().some(change => change.type === "added");
          if (hasNew) {
            const audio = new Audio("https://www.soundjay.com/buttons/beep-01a.mp3");
            audio.play().catch(e => console.warn("Browser blocked audio playback (requires user interaction first).", e));
          }
        }
        isFirstSnapshot = false;

        // --- 4. Update Admin Analytics ---
        updateAnalytics(snapshot.docs);
      });
    } catch (e) {
      console.error("Listener error:", e);
    }
  };

  function updateAnalytics(docs) {
    const activeEl = document.getElementById('active-incidents-count');
    const avgEl = document.getElementById('avg-response-time');
    const totalEl = document.getElementById('total-today-count');

    if (!activeEl || !avgEl || !totalEl) return;

    let activeCount = 0;
    let totalToday = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    const now = new Date();
    const startOfDay = new Date(now.setHours(0,0,0,0));

    docs.forEach(docSnap => {
      const data = docSnap.data();
      const created = data.timestamp ? data.timestamp.toDate() : null;
      const assigned = data.assignedAt ? data.assignedAt.toDate() : null;

      if (data.status === 'active') activeCount++;
      
      if (created && created >= startOfDay) {
        totalToday++;
      }

      if (created && assigned) {
        const diff = (assigned - created) / 1000; // seconds
        totalResponseTime += diff;
        responseCount++;
      }
    });

    // Update UI
    activeEl.innerText = activeCount;
    totalEl.innerText = totalToday;

    if (responseCount > 0) {
      const avg = totalResponseTime / responseCount;
      if (avg < 60) {
        avgEl.innerText = `${Math.round(avg)}s`;
      } else {
        const mins = Math.floor(avg / 60);
        const secs = Math.round(avg % 60);
        avgEl.innerText = `${mins}m ${secs}s`;
      }
    } else {
      avgEl.innerText = "--";
    }
  }

  initFirestoreListener();

  const clearHold = () => {
    clearTimeout(pressTimeout);
    if(sosBtn.style.background !== 'var(--success)') {
      sosHint.innerText = 'Press and hold for 3s';
      sosHint.style.color = 'var(--text-muted)';
    }
  };

  sosBtn.addEventListener('mouseup', clearHold);
  sosBtn.addEventListener('mouseleave', clearHold);
  
  // Mobile touch support
  sosBtn.addEventListener('touchstart', (e) => { e.preventDefault(); sosBtn.dispatchEvent(new Event('mousedown')); });
  sosBtn.addEventListener('touchend', (e) => { e.preventDefault(); sosBtn.dispatchEvent(new Event('mouseup')); });

  function triggerEmergency() {
    // Change Button Visuals
    sosBtn.style.background = 'var(--success)';
    sosBtn.style.boxShadow = '0 0 40px var(--success)';
    sosBtn.style.animation = 'none';
    sosBtn.innerHTML = '<i data-lucide="check" style="width: 60px; height: 60px;"></i>';
    sosHint.innerText = 'SOS Activated';
    sosHint.style.color = 'var(--success)';
    sosHint.classList.remove('pulse-text');
    
    // Show Status Card
    activeStatus.style.display = 'flex';
    activeStatus.classList.add('animate-slide');

    // Re-initialize icon
    lucide.createIcons();
    
    // Simulate real-time update in staff dashboard
    addMockFeedEvent();
    
    // Save to Firestore
    sendSOS("manual", "button");
  }

  // Emergency Type Selection
  typeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });


  // --- 3. Mock Feed Update ---
  function addMockFeedEvent(customText, customType) {
    const dashGrid = document.querySelector('.dashboard-grid');
    if (!dashGrid) return;

    const typeLabel = customType || 'Security';
    const textMsg = customText ? `Voice SOS: "${customText}"` : 'Guest initiated manual SOS request.';
    const iconName = typeLabel === 'Fire' ? 'flame' : (typeLabel === 'Medical' ? 'cross' : 'alert-circle');

    const newCard = document.createElement('div');
    newCard.className = 'glass feed-card critical animate-slide shake-hover';
    newCard.innerHTML = `
      <div class="feed-header">
        <span class="badge critical"><i data-lucide="${iconName}" style="width:14px;height:14px;vertical-align:-2px;"></i> ${typeLabel}</span>
        <span style="font-size:0.8rem; color:var(--accent-red); font-weight:bold;">JUST NOW</span>
      </div>
      <h3 style="margin-bottom:0.3rem;">Room 402 - Main Building</h3>
      <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:1rem;">${textMsg}</p>
      <div style="display:flex; justify-content:space-between; align-items:center;">
         <span class="responder-tag" style="background:rgba(239, 68, 68, 0.2); color:var(--accent-red);">Needs Assignment</span>
         <button class="action-btn">Assign</button>
      </div>
    `;
    
    // Insert at top
    dashGrid.insertBefore(newCard, dashGrid.firstChild);
    lucide.createIcons();
    
    // Update map marker
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
      const marker = document.createElement('div');
      marker.className = 'map-marker critical animate-slide';
      marker.style.top = '40%';
      marker.style.left = '50%';
      marker.innerHTML = '<div class="marker-info glass">Room 402 SOS</div>';
      mapContainer.appendChild(marker);
    }
  }

  // --- 4. Voice SOS Feature ---
  const micBtn = document.getElementById('mic-trigger');
  const micStatus = document.getElementById('mic-status');
  const voiceTranscript = document.getElementById('voice-transcript');
  const voiceAlertModal = document.getElementById('voice-alert-modal');
  const voiceAlertText = document.getElementById('voice-alert-text');
  const voiceCountdown = document.getElementById('voice-countdown');
  const voiceCancelBtn = document.getElementById('voice-cancel');
  const voiceSendBtn = document.getElementById('voice-send');

  let recognition = null;
  let isListening = false;
  let countdownInterval = null;
  let detectedText = "";
  let detectedType = "Security";

  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('mic-active');
      micStatus.innerText = 'Listening...';
      voiceTranscript.style.display = 'block';
      voiceTranscript.innerText = "Say 'Help', 'Fire', or 'Emergency'...";
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = finalTranscript || interimTranscript;
      voiceTranscript.innerText = `"${currentText}"`;
      
      const transcript = currentText.toLowerCase();
      if (transcript.includes("help") || transcript.includes("fire") || transcript.includes("emergency")) {
        sendSOS("voice", transcript); // Passing context to match our db structure
        
        // Update UI to show SOS was sent
        sosBtn.style.background = 'var(--success)';
        sosHint.innerText = 'Voice SOS Sent!';
        sosHint.style.color = 'var(--success)';
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      stopListening();
    };

    recognition.onend = () => {
      if (isListening) {
        try { recognition.start(); } catch(e) {} // Auto-restart if we didn't deliberately stop
      } else {
        micBtn.classList.remove('mic-active');
        micStatus.innerText = 'Tap to start listening again';
        setTimeout(() => { if(!isListening && voiceTranscript) voiceTranscript.style.display = 'none'; }, 2000);
      }
    };

    // Auto-start disabled in favor of Safety Activation Screen (user gesture required)
  } else {
    if(micBtn) micBtn.style.opacity = '0.5';
    if(micStatus) micStatus.innerText = 'Voice API not supported in this browser';
  }

  function stopListening() {
    isListening = false;
    if(recognition) recognition.stop();
    if(micBtn) micBtn.classList.remove('mic-active');
  }

  if(micBtn) {
    micBtn.addEventListener('click', () => {
      if (!recognition) {
        alert("The Voice Recognition Feature is not supported by your current browser. Please use Google Chrome or Microsoft Edge to test this feature.");
        return;
      }
      if (isListening) {
        stopListening();
      } else {
        if(recognition) {
          try {
            recognition.start();
          } catch(e) {}
        }
      }
    });
  }

  if(voiceCancelBtn) {
    voiceCancelBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      voiceAlertModal.style.display = 'none';
      micStatus.innerText = 'Voice alert cancelled. Resuming...';
      setTimeout(() => {
        if(recognition) {
          try { recognition.start(); } catch(e) {}
        }
      }, 1500);
    });
  }

  if(voiceSendBtn) {
    voiceSendBtn.addEventListener('click', () => {
      clearInterval(countdownInterval);
      sendVoiceEmergency();
    });
  }

  function sendVoiceEmergency() {
    if(voiceAlertModal) voiceAlertModal.style.display = 'none';
    
    // Simulate triggering emergency
    sosBtn.style.background = 'var(--success)';
    sosBtn.style.boxShadow = '0 0 40px var(--success)';
    sosBtn.style.animation = 'none';
    sosBtn.innerHTML = '<i data-lucide="check" style="width: 60px; height: 60px;"></i>';
    sosHint.innerText = 'Voice SOS Activated';
    sosHint.style.color = 'var(--success)';
    sosHint.classList.remove('pulse-text');
    
    activeStatus.style.display = 'flex';
    activeStatus.classList.add('animate-slide');
    lucide.createIcons();
    
    addMockFeedEvent(detectedText, detectedType);
    
    // Save to Firestore
    sendSOS(detectedType, detectedText);
  }

  // --- 5. Safety Activation Flow ---
  const safetyOverlay = document.getElementById('safety-overlay');
  const activateBtn = document.getElementById('activate-btn');

  const activateSystem = async () => {
    try {
      micStatus.innerText = 'Requesting Permission...';
      
      // 1. Explicitly request microphone access (Triggering the native browser prompt)
      // We use getUserMedia because it's the more reliable way to trigger the native prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted via getUserMedia");
      
      // 2. Stop the temporary stream (we only needed it for the permission)
      stream.getTracks().forEach(track => track.stop());

      // 3. Start the Speech Recognition engine
      if (recognition) {
        recognition.start();
        console.log("Speech recognition started after user activation");
      }

      // 4. Hide overlay and reveal app
      safetyOverlay.style.transition = 'all 0.5s ease-out';
      safetyOverlay.style.opacity = '0';
      setTimeout(() => {
        safetyOverlay.style.display = 'none';
      }, 500);

    } catch (err) {
      console.error("System activation failed:", err);
      micStatus.innerText = 'Permission denied. Please refresh and allow mic access.';
      alert("Microphone permission is required for Hands-Free SOS. Please allow access in your browser settings and refresh.");
    }
  };

  if (activateBtn) {
    activateBtn.addEventListener('click', activateSystem);
  }

  // --- 6. Admin Analytics & Report Generation ---
  const reportBtn = document.getElementById('report-btn');

  const generateReport = () => {
    if (!reportBtn) return;
    
    const originalContent = reportBtn.innerHTML;
    reportBtn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i> Generating...';
    lucide.createIcons();
    reportBtn.disabled = true;

    setTimeout(() => {
      // Create simple CSV mock data
      const csvContent = "data:text/csv;charset=utf-8," 
        + "Metric,Value\n"
        + "Active Incidents,2\n"
        + "Avg Response Time,1m 45s\n"
        + "Total Today,14\n"
        + "System Status,Active\n"
        + "Report Generated," + new Date().toLocaleString();

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "ResQNet_Analytics_Report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Success feedback
      reportBtn.innerHTML = '<i data-lucide="check" style="color:#10b981;"></i> Success';
      lucide.createIcons();
      
      setTimeout(() => {
        reportBtn.innerHTML = originalContent;
        reportBtn.disabled = false;
        lucide.createIcons();
      }, 2000);
    }, 1500);
  };

  if (reportBtn) {
    reportBtn.addEventListener('click', generateReport);
  }

});
