---
source_url: "https://en.wikipedia.org/api/rest_v1/page/html/Neural_coding"
type: webpage
title: "Neural coding"
captured_at: 2026-10-31T12:24:50.296143+00:00
contributor: "Claude"
---

# Neural coding

Source: https://en.wikipedia.org/api/rest_v1/page/html/Neural_coding

---

Neural coding

Not to be confused with [neural decoding](./Neural_decoding "Neural decoding") or [neural encoding of sound](./Neural_encoding_of_sound "Neural encoding of sound").

Method by which information is represented in the brain

**Neural coding** (or **neural representation**) refers to the relationship between a [stimulus](./Stimulus_(physiology) "Stimulus (physiology)") and its respective neuronal responses, and the [signalling relationships](./Electrophysiology "Electrophysiology") among networks of neurons in an [ensemble](./Neuronal_ensemble "Neuronal ensemble").[[1]](./Neural_coding#cite_note-Brown-1)[[2]](./Neural_coding#cite_note-2) [Action potentials](./Action_potentials "Action potentials"), which act as the primary carrier of information in [biological neural networks](./Biological_neural_networks "Biological neural networks"), are [generally](./Goldman_equation "Goldman equation") [uniform](./Resting_potential "Resting potential") regardless of the type of stimulus or the [specific type of neuron](./Neuron#Classification "Neuron"). The [simplicity](./Channel_capacity "Channel capacity") of action potentials as a methodology of encoding information factored with the indiscriminate process of [summation](./Summation_(neurophysiology) "Summation (neurophysiology)") is seen as discontiguous with the specification capacity that neurons [demonstrate at the presynaptic terminal](./Neurotransmission#Cotransmission "Neurotransmission"), as well as the broad ability for complex neuronal processing and regional specialisation for which the [brain-wide integration](./Large-scale_brain_network "Large-scale brain network") of such is seen as fundamental to complex derivations; such as [intelligence](./Intelligence "Intelligence"), [consciousness](./Consciousness "Consciousness"), [complex social interaction](./Social_dynamics "Social dynamics"), [reasoning](./Reasoning "Reasoning") and [motivation](./Motivation "Motivation").
As such, theoretical frameworks that describe encoding mechanisms of action potential sequences in relationship to observed patterns are seen as fundamental to neuroscientific understanding.[[3]](./Neural_coding#cite_note-thorpe-3)

## Overview

Neurons have an ability uncommon among the cells of the body to propagate signals rapidly over large distances by generating characteristic electrical pulses called [action potentials](./Action_potentials "Action potentials"): voltage spikes that can travel down axons. Sensory neurons change their activities by firing sequences of action potentials in various temporal patterns, with the presence of external sensory stimuli, such as [light](./Light "Light"), [sound](./Sound "Sound"), [taste](./Taste "Taste"), [smell](./Olfaction "Olfaction") and [touch](./Touch "Touch"). Information about the stimulus is encoded in this pattern of action potentials and transmitted into and around the brain. Beyond this, specialized neurons, such as those of the retina, can communicate more information through [graded potentials](./Graded_potential "Graded potential"). These differ from action potentials because information about the strength of a stimulus directly correlates with the strength of the neurons' output. The signal decays much faster for graded potentials, necessitating short inter-neuron distances and high neuronal density. The advantage of graded potentials is higher information rates capable of encoding more states (i.e. higher fidelity) than spiking neurons.[[4]](./Neural_coding#cite_note-4)

Although action potentials can vary somewhat in duration, [amplitude](./Amplitude "Amplitude") and shape, they are typically treated as identical stereotyped events in neural coding studies. If the [brief duration](./Brief-spike?action=edit&redlink=1 "Brief-spike") of an action potential (about 1 ms) is ignored, an action potential sequence, or spike train, can be characterized simply by a series of [all-or-none](./All-or-none_law "All-or-none law") point events in time.[[5]](./Neural_coding#cite_note-Gerstner-5) The lengths of interspike intervals ([ISIs](./Temporal_coding "Temporal coding")) between two successive spikes in a spike train often vary, apparently randomly.[[6]](./Neural_coding#cite_note-Stein-6) The study of neural coding involves measuring and characterizing how stimulus attributes, such as light or [sound intensity](./Sound_intensity "Sound intensity"), or motor actions, such as the direction of an arm movement, are represented by neuron action potentials or spikes. In order to describe and analyze neuronal firing, [statistical methods](./Statistical_methods "Statistical methods") and methods of [probability theory](./Probability_theory "Probability theory") and stochastic [point processes](./Point_process "Point process") have been widely applied.

With the development of large-scale neural recording and decoding technologies, researchers have begun to crack the neural code and have already provided the first glimpse into the real-time neural code as memory is formed and recalled in the hippocampus, a brain region known to be central for memory formation.[[7]](./Neural_coding#cite_note-7)[[8]](./Neural_coding#cite_note-8)[[9]](./Neural_coding#cite_note-9) Neuroscientists have initiated several large-scale brain decoding projects.[[10]](./Neural_coding#cite_note-10)[[11]](./Neural_coding#cite_note-11)

## Encoding and decoding

The link between stimulus and response can be studied from two opposite points of view. Neural encoding refers to the map from stimulus to response. The main focus is to understand how neurons respond to a wide variety of stimuli, and to construct models that attempt to predict responses to other stimuli. [Neural decoding](./Neural_decoding "Neural decoding") refers to the reverse map, from response to stimulus, and the challenge is to reconstruct a stimulus, or certain aspects of that stimulus, from the spike sequences it evokes.[[12]](./Neural_coding#cite_note-12)

## Hypothesized coding schemes

A sequence, or 'train', of spikes may contain information based on different coding schemes. In some neurons the strength with which a postsynaptic partner responds may depend solely on the 'firing rate', the average number of spikes per unit time (a 'rate code'). At the other end, a complex '[temporal code](./Temporal_code "Temporal code")' is based on the precise timing of single spikes. They may be locked to an external stimulus such as in the visual[[13]](./Neural_coding#cite_note-13) and [auditory system](./Auditory_system "Auditory system") or be generated intrinsically by the neural circuitry.[[14]](./Neural_coding#cite_note-Gerstner97-14)

Whether neurons use rate coding or temporal coding is a topic of intense debate within the neuroscience community, even though there is no clear definition of what these terms mean.[[15]](./Neural_coding#cite_note-:0-15)

### Rate code

The rate coding model of [neuronal](./Neuron "Neuron") firing communication states that as the intensity of a stimulus increases, the [frequency](./Frequency "Frequency") or rate of [action potentials](./Action_potential "Action potential"), or "spike firing", increases. Rate coding is sometimes called frequency coding.

Rate coding is a traditional coding scheme, assuming that most, if not all, information about the stimulus is contained in the firing rate of the neuron. Because the sequence of action potentials generated by a given stimulus varies from trial to trial, neuronal responses are typically treated statistically or probabilistically. They may be characterized by firing rates, rather than as specific spike sequences. In most sensory systems, the firing rate increases, generally non-linearly, with increasing stimulus intensity.[[16]](./Neural_coding#cite_note-Kandel-16) Under a rate coding assumption, any information possibly encoded in the temporal structure of the spike train is ignored. Consequently, rate coding is inefficient but highly robust with respect to the ISI '[noise](./Noise "Noise")'.[[6]](./Neural_coding#cite_note-Stein-6)

During rate coding, precisely calculating firing rate is very important. In fact, the term "firing rate" has a few different definitions, which refer to different averaging procedures, such as an **average over time** (rate as a single-neuron spike count) or an **average over several repetitions** (rate of PSTH) of experiment.

In rate coding, learning is based on activity-dependent synaptic weight modifications.

Rate coding was originally shown by [Edgar Adrian](./Edgar_Adrian "Edgar Adrian") and [Yngve Zotterman](./Yngve_Zotterman "Yngve Zotterman") in 1926.[[17]](./Neural_coding#cite_note-17) In this simple experiment different weights were hung from a [muscle](./Muscle "Muscle"). As the weight of the stimulus increased, the number of spikes recorded from sensory nerves innervating the muscle also increased. From these original experiments, Adrian and Zotterman concluded that action potentials were unitary events, and that the frequency of events, and not individual event magnitude, was the basis for most inter-neuronal communication.

In the following decades, measurement of firing rates became a standard tool for describing the properties of all types of sensory or [cortical](./Cerebral_cortex "Cerebral cortex") neurons, partly due to the relative ease of measuring rates experimentally. However, this approach neglects all the information possibly contained in the exact timing of the spikes. During recent years, more and more experimental evidence has suggested that a straightforward firing rate concept based on temporal averaging may be too simplistic to describe brain activity.[[6]](./Neural_coding#cite_note-Stein-6)

#### Spike-count rate (average over time)

The spike-count rate, also referred to as temporal average, is obtained by counting the number of spikes that appear during a trial and dividing by the duration of trial.[[15]](./Neural_coding#cite_note-:0-15) The length T of the time window is set by the experimenter and depends on the type of neuron recorded from and to the stimulus. In practice, to get sensible averages, several spikes should occur within the time window. Typical values are T = 100 ms or T = 500 ms, but the duration may also be longer or shorter ([Chapter 1.5](https://lcnwww.epfl.ch/gerstner/SPNM/node7.html) in the textbook 'Spiking Neuron Models' [[15]](./Neural_coding#cite_note-:0-15)).

The spike-count rate can be determined from a single trial, but at the expense of losing all [temporal resolution](./Temporal_resolution "Temporal resolution") about variations in neural response during the course of the trial. Temporal averaging can work well in cases where the stimulus is constant or slowly varying and does not require a fast reaction of the [organism](./Organism "Organism") — and this is the situation usually encountered in experimental protocols. Real-world input, however, is hardly stationary, but often changing on a fast time scale. For example, even when viewing a static image, humans perform [saccades](./Saccades "Saccades"), rapid changes of the direction of gaze. The image projected onto the retinal [photoreceptors](./Photoreceptor_cell "Photoreceptor cell") changes therefore every few hundred milliseconds ([Chapter 1.5](https://lcnwww.epfl.ch/gerstner/SPNM/node7.html) in [[15]](./Neural_coding#cite_note-:0-15))

Despite its shortcomings, the concept of a spike-count rate code is widely used not only in experiments, but also in models of [neural networks](./Neural_networks "Neural networks"). It has led to the idea that a neuron transforms information about a single input variable (the stimulus strength) into a single continuous output variable (the firing rate).

There is a growing body of evidence that in [Purkinje neurons](./Purkinje_neurons "Purkinje neurons"), at least, information is not simply encoded in firing but also in the timing and duration of non-firing, quiescent periods.[[18]](./Neural_coding#cite_n
